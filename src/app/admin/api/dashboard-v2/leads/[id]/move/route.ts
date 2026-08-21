import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordStageChange } from '@/lib/leadStageHistory';
import { VALID_STAGE_TRANSITIONS } from '@/lib/funnelStages';

// Manual override for the Lead Journey board's quick-action buttons. Reuses
// the exact same lead_stage_history logging the nightly cron already uses
// (changed_by distinguishes 'admin' here vs 'cron' there) so both manual
// and automatic moves show up in the same history trail.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { toStage, reason } = body as { toStage: string; reason?: string };
  if (!toStage) return NextResponse.json({ error: 'toStage is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: lead, error: fetchError } = await supabase.from('leads').select('lifecycle_stage').eq('id', id).single();
  if (fetchError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const validNextStages = VALID_STAGE_TRANSITIONS[lead.lifecycle_stage] || [];
  if (!validNextStages.includes(toStage)) {
    return NextResponse.json({ error: `Cannot move from ${lead.lifecycle_stage} to ${toStage}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, any> = { lifecycle_stage: toStage, stage_entered_at: now };
  if (toStage === 'won') {
    update.is_customer = true;
    update.first_purchase_at = now;
    update.last_purchase_at = now;
  }

  const { error: updateError } = await supabase.from('leads').update(update).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await recordStageChange(supabase, id, {
    fromStage: lead.lifecycle_stage,
    toStage,
    changedBy: 'admin',
    reason: reason || 'Manual move via Lead Journey board',
  });

  // Echo back what actually changed so the client can merge it into local
  // state directly instead of refetching the whole board (which flashes the
  // full-page loading state on every single action).
  return NextResponse.json({ ok: true, lifecycle_stage: toStage, stage_entered_at: now });
}
