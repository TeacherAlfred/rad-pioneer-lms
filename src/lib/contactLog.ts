// Fixed vocabulary for admin-authored lead_activities entries (the manual
// contact log, as opposed to the webhook's own outcome values like
// 'contacted'/'no_response'/'followup_scheduled' - both vocabularies share
// the same free-text `channel`/`outcome` columns with no DB constraint, so
// this file is what keeps the admin-facing form's options queryable without
// a migration every time the list changes. Same pattern as
// LIFECYCLE_STAGES/LIFECYCLE_STAGE_LABELS in funnelStages.ts.

export const CONTACT_CHANNELS = ['whatsapp', 'call', 'email', 'linkedin'];

export const CONTACT_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  call: 'Call',
  email: 'Email',
  linkedin: 'LinkedIn',
};

export const CONTACT_OBJECTIVES = ['webinar', 'workshop', 'enrolment_followup', 'general_checkin', 'other'];

export const CONTACT_OBJECTIVE_LABELS: Record<string, string> = {
  webinar: 'Webinar',
  workshop: 'Workshop',
  enrolment_followup: 'Enrolment Follow-up',
  general_checkin: 'General Check-in',
  other: 'Other',
};

export const CONTACT_OUTCOMES = ['no_answer', 'interested_following_up', 'booked', 'not_interested'];

export const CONTACT_OUTCOME_LABELS: Record<string, string> = {
  no_answer: 'No answer',
  interested_following_up: 'Interested, following up',
  booked: 'Booked',
  not_interested: 'Not interested',
};

// Outcomes that count as "this contact went somewhere" for the call queue's
// responsiveness tiebreak (src/lib/leadUrgency.ts) - deliberately excludes
// the webhook's own no_response-shaped values too, so a lead's history reads
// consistently regardless of which vocabulary logged each entry.
const UNRESPONSIVE_OUTCOMES = new Set(['no_answer', 'not_interested', 'no_response']);

export function isResponsiveOutcome(outcome: string): boolean {
  return !UNRESPONSIVE_OUTCOMES.has(outcome);
}
