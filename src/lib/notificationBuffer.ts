// Server-only: the actual consolidation/send logic for buffered admin
// notifications, shared between the external cron-triggered endpoint
// (src/app/api/lead-funnel/notify-flush) and the admin-facing manual
// "release now" endpoint (src/app/admin/api/lead-funnel/notify-flush).
//
// 2026-09-16: retired the old "one consolidated message per lead, after
// that lead's own buffer window" model in favor of a single global,
// stats-only digest every buffer_minutes (default 30) - a lead-by-lead
// blow-by-blow no longer reaches the admin's WhatsApp at all; they read
// Message Activity/the app itself for who-did-what. New-lead alerts are
// untouched (still immediate, individual, with STATUS_BUTTONS) - see
// notifyAdmin() in whatsapp-webhook/route.ts, which now only ever passes
// { immediate: true } for that one case.
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';
import { isWithinDnd, type DndDay } from '@/lib/dndSchedule';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_DIGEST_MINUTES = 30;

// The WhatsApp digest itself is pure counts (no lead names - see the
// digest's own body text below); this categorization only groups by kind of
// event, derived from each event_text's own leading emoji/phrasing rather
// than a stored category column, since every notifyAdmin() call site across
// the webhook already writes a consistent prefix. Order matters - checked
// top to bottom, first match wins.
const CATEGORY_RULES: { test: RegExp; label: string }[] = [
  { test: /needs a human|passed to educator|manual replies only|handed to a human/i, label: "Needs a human" },
  { test: /^⚠️|failed/i, label: "Failures" },
  { test: /^🔘/, label: "Button taps" },
  { test: /^📥/, label: "Downloads" },
  { test: /^📝/, label: "Replies captured" },
  { test: /^🚫/, label: "Opt-out activity" },
  { test: /^📋/, label: "Queued for approval" },
  { test: /^💬/, label: "Messages received" },
];

function categorize(eventText: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(eventText)) return rule.label;
  }
  return "Other";
}

function tallyByCategory(rows: { event_text: string }[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) {
    const cat = categorize(row.event_text);
    tally[cat] = (tally[cat] || 0) + 1;
  }
  return tally;
}

export async function getDndSchedule(): Promise<DndDay[]> {
  const { data } = await supabaseAdmin.from('admin_dnd_schedule').select('*').order('day_of_week');
  return data || [];
}

async function getSettings(): Promise<{ digestMinutes: number; lastDigestSentAt: string | null }> {
  const { data } = await supabaseAdmin.from('admin_notification_settings').select('buffer_minutes, last_digest_sent_at').limit(1).maybeSingle();
  return {
    digestMinutes: data?.buffer_minutes ?? DEFAULT_DIGEST_MINUTES,
    lastDigestSentAt: data?.last_digest_sent_at ?? null,
  };
}

// Stamped every time a digest cycle is considered "due," whether or not
// there was anything to actually send - keeps the cadence a true fixed
// interval instead of one that resets on bursty activity (an event landing
// right after a quiet spell would otherwise look "overdue" immediately).
async function markDigestMoment() {
  await supabaseAdmin.from('admin_notification_settings').update({ last_digest_sent_at: new Date().toISOString() }).not('id', 'is', null);
}

type BufferRow = { id: string; lead_id: string | null; event_text: string; created_at: string };

async function getPendingRows(): Promise<BufferRow[]> {
  const { data, error } = await supabaseAdmin
    .from('admin_notification_buffer')
    .select('id, lead_id, event_text, created_at')
    .is('flushed_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// What the settings page shows - doesn't send anything, just reports what's
// queued (as category counts, same shape the digest itself uses) and when
// the next one goes out.
export async function getPendingPreview() {
  const [rows, { digestMinutes, lastDigestSentAt }, schedule] = await Promise.all([
    getPendingRows(),
    getSettings(),
    getDndSchedule(),
  ]);

  const dndActive = isWithinDnd(schedule);
  const nextDigestAt = new Date((lastDigestSentAt ? new Date(lastDigestSentAt).getTime() : Date.now()) + digestMinutes * 60 * 1000).toISOString();

  return {
    pendingCount: rows.length,
    byCategory: tallyByCategory(rows),
    dndActive,
    digestMinutes,
    lastDigestSentAt,
    nextDigestAt,
    overdue: !dndActive && rows.length > 0 && Date.now() >= new Date(nextDigestAt).getTime(),
  };
}

// The actual send. `force` bypasses both the digest timer and DND (used
// only by the admin's manual "release now" - the automatic cron-triggered
// route always calls this with force: false).
export async function flushBufferedNotifications(opts: { force?: boolean } = {}): Promise<{ flushed: number; reason?: string }> {
  const schedule = await getDndSchedule();
  if (!opts.force && isWithinDnd(schedule)) {
    return { flushed: 0, reason: 'dnd' };
  }

  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) throw new Error('ADMIN_PHONE_NUMBER is not configured');

  const { digestMinutes, lastDigestSentAt } = await getSettings();
  if (!opts.force) {
    const dueAt = (lastDigestSentAt ? new Date(lastDigestSentAt).getTime() : 0) + digestMinutes * 60 * 1000;
    if (Date.now() < dueAt) return { flushed: 0, reason: 'not_due' };
  }

  const rows = await getPendingRows();
  // Counts as a digest moment either way - see markDigestMoment's comment.
  await markDigestMoment();
  if (rows.length === 0) return { flushed: 0, reason: 'nothing_pending' };

  const tally = tallyByCategory(rows);
  const lines = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `• ${count} ${label.toLowerCase()}`);
  const digestText = `📊 *Pipeline Digest* — last ${digestMinutes} min\n\n${rows.length} event${rows.length === 1 ? '' : 's'} total\n${lines.join('\n')}\n\nCheck Message Activity in the app for who/what.`;

  const result = await sendWhatsAppMessage(adminPhone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: digestText },
      action: { buttons: [{ type: 'reply', reply: { id: 'btn_digest_noted', title: 'Noted 👍' } }] },
    },
  });

  // Deliberately NOT logged to `messages` - a global digest isn't part of
  // any single lead's conversation, so it has no home in Message Activity
  // (which is organized per-lead) and shouldn't surface there at all.
  if (!result.ok) {
    console.error('❌ Failed to send admin digest:', result.error);
    // Left unflushed on failure (flushed_at stays null) - they roll into
    // the next due cycle instead of being lost, a simpler self-healing
    // retry than the old per-lead pending_admin_alerts fallback table.
    return { flushed: 0, reason: 'send_failed' };
  }

  await supabaseAdmin.from('admin_notification_buffer').update({ flushed_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
  return { flushed: rows.length };
}
