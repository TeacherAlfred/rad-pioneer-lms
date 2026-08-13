// Every place that sets leads.status (webhook, irene consent, warm-list
// commit, the lead-funnel admin API) must also call this, or the funnel
// stages dashboard's time-in-stage / messages-per-stage numbers go stale
// the moment a status changes without a matching history row.
export async function recordStatusChange(supabase: any, leadId: string, status: string) {
  await supabase.from('lead_status_history').insert([{ lead_id: leadId, status }]);
}
