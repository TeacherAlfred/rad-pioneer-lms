// Ad-set matching for the "robotics watch" campaign - multiple ad creatives
// (different ad_id per creative, same underlying pitch/campaign) that all
// route to the same custom first-contact greeting. Matched on Meta's
// referral.source_id (stored as leads.ad_id at first contact) - see the
// gating branch in src/app/api/whatsapp-webhook/route.ts's STAGE 1. Every
// ad-referral lead outside this set keeps the standard welcome menu.
export const AD_SET_ROBOTICS_WATCH_IDS = [
  '120248999130920372', // "The skill your watch doesn't teach"
  '120248999130910372', // "Ask them what they'd rather do"
];
export function isRoboticsWatchAd(adId: string | null | undefined): boolean {
  return !!adId && AD_SET_ROBOTICS_WATCH_IDS.includes(adId);
}

// The automated 24h-silence follow-up that used to live here (polled via
// notify-flush) has been removed - it kept failing (Meta error 131047,
// freeform sends rejected outside the 24h window) and even after being
// switched to the pre-approved rad_robotics_followup template, the user
// decided manual control is preferred over another automated send. Send it
// manually instead: Lead Funnel table -> select the due leads -> Send
// Template -> rad_robotics_followup, with that template's one QUICK_REPLY
// button payload set to btn_ad6219_register so a tap still routes through
// Bot Flows normally.
