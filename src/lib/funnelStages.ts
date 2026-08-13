// Ordered funnel stages this app understands - shared between the
// lead-funnel API routes and the stages dashboard's aggregation.
// new_lead/needs_human/contacted/followup_scheduled/no_response come from
// the bot and the admin's WhatsApp pipeline buttons; converted/lost are
// terminal outcomes only settable manually from the admin UI (a WhatsApp
// button set is capped at 3, already used by Contacted/No Response/
// Follow-up Set).
export const FUNNEL_STAGES = ['new_lead', 'needs_human', 'contacted', 'followup_scheduled', 'no_response', 'converted', 'lost'];

export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  needs_human: 'Needs Human',
  contacted: 'Contacted',
  followup_scheduled: 'Follow-up Scheduled',
  no_response: 'No Response',
  converted: 'Converted',
  lost: 'Lost',
};
