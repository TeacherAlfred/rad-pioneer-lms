import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';
import { STATUS_BUTTONS } from '@/lib/adminPipelineButtons';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_BUFFER_MINUTES = 10;

function isWithinDnd(settings: { dnd_enabled: boolean; dnd_start_time: string | null; dnd_end_time: string | null } | null): boolean {
  if (!settings?.dnd_enabled || !settings.dnd_start_time || !settings.dnd_end_time) return false;
  const now = new Date().toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false });
  const start = settings.dnd_start_time.slice(0, 5);
  const end = settings.dnd_end_time.slice(0, 5);
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end; // wraps past midnight
}

// Consolidates admin_notification_buffer into one WhatsApp message PER LEAD
// (never one message spanning multiple leads) once that lead's oldest
// unflushed event has sat for at least buffer_minutes. Meant to be hit on
// an external schedule (the user's cron-job.org account, not Vercel Cron -
// Vercel's Hobby tier only allows daily cron, too coarse for a 5-10 minute
// buffer) - hence a custom bearer secret rather than Vercel's automatic
// CRON_SECRET injection.
export async function GET(request: Request) {
  const secret = process.env.WABA_API;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { data: settings } = await supabaseAdmin.from('admin_notification_settings').select('*').limit(1).maybeSingle();

    // Quiet hours hold EVERYTHING back, no matter how overdue - the next
    // flush after DND ends will find every window already elapsed and send
    // each lead's consolidated summary then, with no special-casing needed.
    if (isWithinDnd(settings)) {
      return NextResponse.json({ flushed: 0, reason: 'dnd' });
    }

    const bufferMinutes = settings?.buffer_minutes ?? DEFAULT_BUFFER_MINUTES;
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (!adminPhone) {
      return NextResponse.json({ error: 'ADMIN_PHONE_NUMBER is not configured' }, { status: 500 });
    }

    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from('admin_notification_buffer')
      .select('*')
      .is('flushed_at', null)
      .order('created_at', { ascending: true });
    if (pendingErr) throw pendingErr;

    const byLead = new Map<string, typeof pending>();
    for (const row of pending || []) {
      if (!byLead.has(row.lead_id)) byLead.set(row.lead_id, []);
      byLead.get(row.lead_id)!.push(row);
    }

    const now = Date.now();
    const dueLeadIds = Array.from(byLead.entries())
      .filter(([, rows]) => now - new Date(rows[0].created_at).getTime() >= bufferMinutes * 60 * 1000)
      .map(([leadId]) => leadId);

    if (dueLeadIds.length === 0) {
      return NextResponse.json({ flushed: 0 });
    }

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
        // Same recovery path immediate sends already use when the 24hr
        // session window is closed - flushed_at still gets set below so
        // this doesn't get re-attempted by both mechanisms.
        await supabaseAdmin.from('pending_admin_alerts').insert([{ lead_phone: lead.phone, stage_text: alertText }]);
      }

      await supabaseAdmin.from('admin_notification_buffer').update({ flushed_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
      flushed++;
    }

    return NextResponse.json({ flushed });
  } catch (error: any) {
    console.error('notify-flush error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
