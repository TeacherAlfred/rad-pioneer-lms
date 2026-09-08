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
import { sendWhatsAppMessage } from '@/lib/metaTemplate';

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
// Reserved for the real robotics guide once it exists (see
// btn_ad6219_guide in bot_flows, which has the same "not built yet, no code
// change needed later" note) - looked up fresh each run, so uploading an
// active bot_media row under this keyword is the only step needed to start
// attaching it here.
const ROBOTICS_GUIDE_KEYWORD = 'robotics_watch_guide';

const FOLLOWUP_TEXT = "Hey, following up! In case the live session doesn't fit your schedule, here's the guide we mentioned - a quick read on what robotics and coding actually teach kids.\n\nStill keen to see it live instead?";

export async function sendAdFollowups(): Promise<{ sent: number; failed: number }> {
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
  if (!dueLeads || dueLeads.length === 0) return { sent: 0, failed: 0 };

  // Graceful upgrade: if the real guide has been uploaded to bot_media
  // under this keyword by now, attach it - otherwise send text-only.
  const { data: guideMedia } = await supabaseAdmin
    .from('bot_media')
    .select('file_url, filename')
    .eq('active', true)
    .contains('trigger_keywords', [ROBOTICS_GUIDE_KEYWORD])
    .maybeSingle();

  let sent = 0;
  let failed = 0;
  for (const lead of dueLeads) {
    const payload: any = {
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(guideMedia ? { header: { type: 'document', document: { link: guideMedia.file_url, filename: guideMedia.filename } } } : {}),
        body: { text: FOLLOWUP_TEXT },
        action: { buttons: [{ type: 'reply', reply: { id: 'btn_ad6219_register', title: 'Register for Webinar' } }] },
      },
    };
    const result = await sendWhatsAppMessage(lead.phone, payload);

    await supabaseAdmin.from('messages').insert([{
      lead_id: lead.id,
      direction: 'outbound',
      body: result.ok ? '[Delivered ad follow-up: robotics_watch]' : `[FAILED to deliver ad follow-up: ${result.error}]`,
      wamid: result.wamid || null,
      meta_message_status: result.messageStatus || null,
      ...(result.ok ? {} : { status: 'failed', error_code: result.errorCode || null, error_detail: result.error || null }),
    }]);

    // Stamped regardless of send success - a hard Meta rejection (e.g.
    // window closed) won't fix itself on the next poll either, and without
    // this the lead would get retried every 5-10 minutes indefinitely.
    await supabaseAdmin.from('leads').update({ ad_followup_sent_at: new Date().toISOString() }).eq('id', lead.id);

    if (result.ok) sent++; else failed++;
  }

  return { sent, failed };
}
