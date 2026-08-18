// Server-only: the actual consolidation/send logic for buffered admin
// notifications, shared between the external cron-triggered endpoint
// (src/app/api/lead-funnel/notify-flush) and the admin-facing manual
// "release now" endpoint (src/app/admin/api/lead-funnel/notify-flush) -
// having two copies of "group by lead, build one message, send, mark
// flushed, fall back to pending_admin_alerts on failure" was exactly the
// kind of drift risk that made STATUS_BUTTONS get extracted earlier.
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';
import { STATUS_BUTTONS } from '@/lib/adminPipelineButtons';
import { isWithinDnd, type DndDay } from '@/lib/dndSchedule';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_BUFFER_MINUTES = 10;

export async function getDndSchedule(): Promise<DndDay[]> {
  const { data } = await supabaseAdmin.from('admin_dnd_schedule').select('*').order('day_of_week');
  return data || [];
}

async function getBufferMinutes(): Promise<number> {
  const { data } = await supabaseAdmin.from('admin_notification_settings').select('buffer_minutes').limit(1).maybeSingle();
  return data?.buffer_minutes ?? DEFAULT_BUFFER_MINUTES;
}

type BufferRow = { id: string; lead_id: string; event_text: string; created_at: string };

async function groupPendingByLead(): Promise<Map<string, BufferRow[]>> {
  const { data: pending, error } = await supabaseAdmin
    .from('admin_notification_buffer')
    .select('*')
    .is('flushed_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const byLead = new Map<string, BufferRow[]>();
  for (const row of pending || []) {
    if (!byLead.has(row.lead_id)) byLead.set(row.lead_id, []);
    byLead.get(row.lead_id)!.push(row);
  }
  return byLead;
}

// What the settings page's "pending for next cycle" panel shows - doesn't
// send anything, just reports what's queued and when it'll naturally go
// out (or "waiting for Do Not Disturb to end" if that's what's holding it).
export async function getPendingPreview() {
  const [byLead, bufferMinutes, schedule, lastFlushRow] = await Promise.all([
    groupPendingByLead(),
    getBufferMinutes(),
    getDndSchedule(),
    supabaseAdmin.from('admin_notification_buffer').select('flushed_at').not('flushed_at', 'is', null).order('flushed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const dndActive = isWithinDnd(schedule);
  const leadIds = Array.from(byLead.keys());
  const { data: leads } = leadIds.length > 0
    ? await supabaseAdmin.from('leads').select('id, name, phone').in('id', leadIds)
    : { data: [] as any[] };
  const leadById = new Map((leads || []).map(l => [l.id, l]));

  const pending = Array.from(byLead.entries()).map(([leadId, rows]) => {
    const lead = leadById.get(leadId);
    const windowStart = rows[0].created_at;
    const willFlushAt = new Date(new Date(windowStart).getTime() + bufferMinutes * 60 * 1000).toISOString();
    return {
      leadId,
      leadName: lead?.name || null,
      leadPhone: lead?.phone || null,
      count: rows.length,
      events: rows.map(r => r.event_text),
      windowStart,
      willFlushAt,
      overdue: !dndActive && Date.now() >= new Date(willFlushAt).getTime(),
    };
  });

  return {
    pending,
    dndActive,
    bufferMinutes,
    lastFlushedAt: lastFlushRow.data?.flushed_at || null,
  };
}

// The actual send. `force` bypasses both the buffer timer and DND (used
// only by the admin's manual "release now" - the automatic cron-triggered
// route always calls this with force: false). `onlyLeadId` scopes to one
// lead's queue instead of everyone due.
export async function flushBufferedNotifications(opts: { force?: boolean; onlyLeadId?: string } = {}): Promise<{ flushed: number; reason?: string }> {
  const schedule = await getDndSchedule();
  if (!opts.force && isWithinDnd(schedule)) {
    return { flushed: 0, reason: 'dnd' };
  }

  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) throw new Error('ADMIN_PHONE_NUMBER is not configured');

  const bufferMinutes = await getBufferMinutes();
  const byLead = await groupPendingByLead();

  let dueLeadIds = Array.from(byLead.keys());
  if (opts.onlyLeadId) {
    dueLeadIds = dueLeadIds.filter(id => id === opts.onlyLeadId);
  } else if (!opts.force) {
    const now = Date.now();
    dueLeadIds = dueLeadIds.filter(id => now - new Date(byLead.get(id)![0].created_at).getTime() >= bufferMinutes * 60 * 1000);
  }
  // force + no onlyLeadId = release everyone currently queued, regardless of window age.

  if (dueLeadIds.length === 0) return { flushed: 0 };

  const { data: leads } = await supabaseAdmin.from('leads').select('id, phone, name').in('id', dueLeadIds);
  const leadById = new Map((leads || []).map(l => [l.id, l]));

  let flushed = 0;
  for (const leadId of dueLeadIds) {
    const rows = byLead.get(leadId)!;
    const lead = leadById.get(leadId);
    if (!lead) continue; // lead deleted since - drop the queued rows below without sending

    const lines = rows.map(r => `• ${r.event_text} — ${new Date(r.created_at).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' })}`);
    const alertText = `📋 *Lead Update* (${rows.length} action${rows.length === 1 ? '' : 's'})\n\nLead: +${lead.phone}${lead.name ? ` (${lead.name})` : ''}\n\n${lines.join('\n')}\n\nReach out instantly: https://wa.me/${lead.phone}`;

    const result = await sendWhatsAppMessage(adminPhone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: alertText },
        action: {
          buttons: Object.entries(STATUS_BUTTONS).map(([prefix, def]) => ({
            type: 'reply',
            reply: { id: `${prefix}_${leadId}`, title: def.title },
          })),
        },
      },
    });

    if (!result.ok) {
      await supabaseAdmin.from('pending_admin_alerts').insert([{ lead_phone: lead.phone, stage_text: alertText }]);
    }

    await supabaseAdmin.from('admin_notification_buffer').update({ flushed_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
    flushed++;
  }

  return { flushed };
}
