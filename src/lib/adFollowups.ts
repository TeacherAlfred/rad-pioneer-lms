// Delayed (as opposed to button-triggered) follow-ups for a specific ad
// campaign - a new category of automation for this codebase. Every other
// send in this app fires either off an inbound button tap (bot_flows) or a
// fixed schedule that isn't tied to an individual lead's own timeline
// (the nightly/quarterly crons). This is neither: "24h after this specific
// lead's first inbound, if they never replied, send X" - so it can't live
// in bot_flows, and needs a poll rather than a one-shot timer (this is a
// Vercel serverless app, nothing stays running to literally wait 24h).
//
// Piggybacks on the existing notify-flush poll (see
// src/app/api/lead-funnel/notify-flush/route.ts) - that endpoint is already
// hit every 5-10 minutes by an external cron-job.org job for the admin
// notification buffer, so this rides the same cadence instead of needing a
// second external cron entry.
import { createClient } from '@supabase/supabase-js';
import { sendMetaTemplate } from '@/lib/metaTemplate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The "robotics watch" ad set - multiple ad creatives (different ad_id per
// creative, same underlying pitch/campaign) that all route to the same
// custom greeting/follow-up. Matched on Meta's referral.source_id (stored
// as leads.ad_id at first contact). Every ad-referral lead outside this set
// keeps the standard welcome menu.
export const AD_SET_ROBOTICS_WATCH_IDS = [
  '120248999130920372', // "The skill your watch doesn't teach"
  '120248999130910372', // "Ask them what they'd rather do"
];
export function isRoboticsWatchAd(adId: string | null | undefined): boolean {
  return !!adId && AD_SET_ROBOTICS_WATCH_IDS.includes(adId);
}

const FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000;

// Meta rejects a freeform/interactive send once the customer-service window
// has closed (error 131047) - and this function only ever fires AFTER 24h of
// silence, meaning the window is guaranteed closed by construction. So this
// has to go out as a pre-approved template (exempt from the window), not a
// freeform message like the rest of this file's sibling sends. Approved via
// the Template Rollout Wizard's own mechanism (see template_rollouts row of
// the same name) - the exact copy lives there, not duplicated here.
const FOLLOWUP_TEMPLATE_NAME = 'rad_robotics_followup';
const FOLLOWUP_TEMPLATE_LANGUAGE = 'en';

// A template's structure (including whether it has a document header) is
// fixed at Meta-approval time, not swappable per send like a freeform
// message's header was. So the "attach the real guide once it exists"
// upgrade this file used to do for free is on hold until then - once the
// guide is ready, submit a second template with a document header via the
// wizard and point FOLLOWUP_TEMPLATE_NAME at it (or add a variant lookup
// here). Not building that now since the guide doesn't exist yet either.

export async function sendAdFollowups(): Promise<{ sent: number; failed: number; pending: number }> {
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_MS).toISOString();
  const { data: dueLeads, error } = await supabaseAdmin
    .from('leads')
    .select('id, phone')
    .in('ad_id', AD_SET_ROBOTICS_WATCH_IDS)
    .eq('lifecycle_stage', 'new') // this codebase's existing "never replied since first contact" signal
    .is('ad_followup_sent_at', null)
    .lte('last_inbound_at', cutoff)
    .limit(100);
  if (error) throw error;
  if (!dueLeads || dueLeads.length === 0) return { sent: 0, failed: 0, pending: 0 };

  let sent = 0;
  let failed = 0;
  let pending = 0;
  for (const lead of dueLeads) {
    const result = await sendMetaTemplate(
      lead.phone,
      FOLLOWUP_TEMPLATE_NAME,
      FOLLOWUP_TEMPLATE_LANGUAGE,
      [],
      [],
      ['btn_ad6219_register'] // the template's one QUICK_REPLY button payload
    );

    // 132001 = template name/language not found under this WABA, which is
    // also what Meta returns while a submitted template is still PENDING
    // review - not a real failure, just "not approved yet". Skip logging
    // and don't stamp ad_followup_sent_at so the next poll retries once
    // Meta approves it, instead of silently burning the lead's one shot.
    if (!result.ok && result.errorCode === '132001') {
      pending++;
      continue;
    }

    await supabaseAdmin.from('messages').insert([{
      lead_id: lead.id,
      direction: 'outbound',
      body: result.ok ? '[Delivered ad follow-up: robotics_watch]' : `[FAILED to deliver ad follow-up: ${result.error}]`,
      wamid: result.wamid || null,
      meta_message_status: result.messageStatus || null,
      ...(result.ok ? {} : { status: 'failed', error_code: result.errorCode || null, error_detail: result.error || null }),
    }]);

    // Stamped on success or on a genuine (non-pending-approval) failure - a
    // hard Meta rejection unrelated to template approval won't fix itself
    // on the next poll either, and without this the lead would get retried
    // every 5-10 minutes indefinitely.
    await supabaseAdmin.from('leads').update({ ad_followup_sent_at: new Date().toISOString() }).eq('id', lead.id);

    if (result.ok) sent++; else failed++;
  }

  return { sent, failed, pending };
}
