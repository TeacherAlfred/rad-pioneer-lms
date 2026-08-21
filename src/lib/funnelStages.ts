// Lifecycle stages a lead moves through toward its next purchase, per
// RAD_Lead_Stages_and_Followup_Spec.md. Stages describe the journey only -
// contact outcomes live in lead_activities, "have they ever paid" lives in
// leads.is_customer (never regresses), and "who needs a reply right now"
// lives in leads.needs_human. None of those are stages.
export const LIFECYCLE_STAGES = ['new', 'engaged', 'qualified', 'offered', 'won', 're_nurture', 'lost', 'opted_out'];

export const LIFECYCLE_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  engaged: 'Engaged',
  qualified: 'Qualified',
  offered: 'Offered',
  won: 'Won',
  re_nurture: 'Re-nurture',
  lost: 'Lost',
  opted_out: 'Opted Out',
};

// Expected time-in-stage before stage_health flips from 'active' to
// 'stalled' (spec §3). won/lost/opted_out are terminal - no stall applies.
export const STAGE_STALL_HOURS: Record<string, number> = {
  new: 3 * 24,
  engaged: 14 * 24,
  qualified: 3 * 24,
  offered: 48,
  re_nurture: 90 * 24,
};

// Which moves a quick-action button should offer from each stage - not a
// hard DB constraint, just what's sane for the dashboard-v2 Lead Journey
// board's manual override buttons. `lost`/`opted_out` are recoverable (the
// cron's auto-lost is explicitly reversible on any new inbound), `won`
// loops back into re_nurture for the next purchase cycle rather than being
// a dead end.
export const VALID_STAGE_TRANSITIONS: Record<string, string[]> = {
  new: ['engaged', 'opted_out', 'lost'],
  engaged: ['qualified', 're_nurture', 'opted_out', 'lost'],
  qualified: ['offered', 're_nurture', 'lost'],
  offered: ['won', 're_nurture', 'lost'],
  re_nurture: ['engaged', 'qualified', 'offered', 'lost', 'opted_out'],
  won: ['re_nurture'],
  lost: ['re_nurture'],
  opted_out: [],
};
