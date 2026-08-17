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
