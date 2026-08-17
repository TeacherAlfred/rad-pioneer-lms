// Every place that sets leads.lifecycle_stage (webhook, irene consent, warm-list
// commit, the lead-funnel admin API) must also call this, or the funnel
// stages dashboard's time-in-stage / messages-per-stage numbers go stale
// the moment a stage changes without a matching history row.
export async function recordStageChange(
  supabase: any,
  leadId: string,
  params: { fromStage?: string | null; toStage: string; changedBy?: string | null; reason?: string | null; batchId?: string | null }
) {
  await supabase.from('lead_stage_history').insert([{
    lead_id: leadId,
    from_stage: params.fromStage ?? null,
    to_stage: params.toStage,
    changed_by: params.changedBy ?? null,
    reason: params.reason ?? null,
    batch_id: params.batchId ?? null,
  }]);
}
