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

// null means "logged, response not captured yet" (see the two-phase outcome
// migration) - not yet knowable either way, so it's neither responsive nor
// unresponsive. Callers computing a ratio should exclude these entirely
// rather than treating null as a miss.
export function isResponsiveOutcome(outcome: string | null | undefined): boolean {
  if (!outcome) return false;
  return !UNRESPONSIVE_OUTCOMES.has(outcome);
}

const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Same "log a contact attempt, resolve the call queue" behavior as
// POST /admin/api/lead-funnel/activities (used by ContactLogForm), extracted
// so a send path outside the queue's own "Log Outcome" button - today just
// the Lead Funnel list's bulk Send Template action - can get the same
// automatic result: the habit tracker's "leads contacted" count and the
// queue both reflect a template send the moment it goes out, not only a
// manually-logged call. outcome is deliberately left unset (unknowable at
// send time), same two-phase shape as a logged-but-unanswered call -
// response_due_at is stamped 24h out for the same nightly-cron review the
// Call Queue's "Needs Response" tab already surfaces.
//
// If the lead has no pending queue entry right now, one is created and
// immediately resolved too - "a template went out" is itself a completed
// contact attempt, whether or not this lead happened to be queued for it.
export async function logOutboundContactAndResolveQueue(supabase: any, leadId: string, note: string, createdBy = 'send_template') {
  await supabase.from('lead_activities').insert([{
    lead_id: leadId,
    channel: 'whatsapp',
    direction: 'outbound',
    outcome: null,
    note,
    created_by: createdBy,
    response_due_at: new Date(Date.now() + RESPONSE_WINDOW_MS).toISOString(),
  }]);
  await supabase.from('leads').update({ needs_human: false }).eq('id', leadId);

  const { data: pendingQueueRow } = await supabase
    .from('lead_call_queue')
    .select('id')
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .maybeSingle();

  const queueRowId = pendingQueueRow?.id
    || (await supabase.from('lead_call_queue').insert([{ lead_id: leadId }]).select('id').single()).data?.id;

  if (queueRowId) {
    await supabase.from('lead_call_queue').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', queueRowId);
  }
}
