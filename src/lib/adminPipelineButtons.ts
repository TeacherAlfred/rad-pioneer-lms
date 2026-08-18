// Contact-attempt outcomes the admin can log directly from a pipeline
// alert's buttons - shared between the webhook (which builds single-event
// alerts and decodes the button tap back into a lead_activities row) and
// the notify-flush endpoint (which builds the same buttons onto a
// consolidated multi-event alert). Must stay one source of truth - the
// webhook's button handler matches on these exact ids/titles. Button title
// max 20 chars (Meta error 131009); id prefix + "_" + leadId is what the
// webhook's admin button handler matches back to a lead_activities row.
export const STATUS_BUTTONS: Record<string, { title: string; outcome: string; label: string }> = {
  status_contacted: { title: 'Contacted', outcome: 'contacted', label: 'Contacted successfully' },
  status_no_response: { title: 'No Response', outcome: 'no_response', label: 'Contacted, no response' },
  status_followup: { title: 'Follow-up Set', outcome: 'followup_scheduled', label: 'Follow-up/call scheduled' },
};
