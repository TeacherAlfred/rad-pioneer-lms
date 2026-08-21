import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { QUALIFICATION_STAGES } from '@/lib/leadQualification';
import { recordStageChange } from '@/lib/leadStageHistory';

// Stages a disqualified lead should never be auto-moved out of - it's
// already reached a real outcome (a sale, or a deliberate exit) that a
// qualification-check failure discovered after the fact shouldn't override.
const TERMINAL_STAGES = ['won', 'lost', 'opted_out'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { stage_key, passed, notes } = body as { stage_key: string; passed: boolean; notes?: string };

  const stage = QUALIFICATION_STAGES.find((s) => s.key === stage_key);
  if (!stage) {
    return NextResponse.json({ error: `Unknown stage_key: ${stage_key}` }, { status: 400 });
  }
  if (typeof passed !== 'boolean') {
    return NextResponse.json({ error: 'passed must be a boolean' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('lead_qualification_checks')
    .upsert(
      { lead_id: id, stage_key, passed, checked_at: new Date().toISOString(), checked_by: 'admin', notes: notes || null },
      { onConflict: 'lead_id,stage_key' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A failed check disqualifies the lead outright - auto-move it to `lost`
  // (same lifecycle_stage/lost_reason/history-logging shape the nightly
  // cron already uses for its own auto-moves) rather than leaving it
  // sitting invisibly in whatever stage it happened to be in. Skipped if
  // the lead already reached a terminal stage - a won sale or a prior
  // deliberate lost/opted_out shouldn't be overwritten by a qualification
  // check made after the fact.
  // Echo back the check that was just set plus any resulting stage change so
  // the client can merge this directly into local state instead of
  // refetching the whole board (which flashes the full-page loading state
  // on every single click).
  const result: { ok: true; check: { stage_key: string; passed: boolean }; movedToLost?: boolean; stage_entered_at?: string } = {
    ok: true,
    check: { stage_key, passed },
  };

  if (!passed) {
    const { data: lead } = await supabase.from('leads').select('lifecycle_stage').eq('id', id).single();
    if (lead && !TERMINAL_STAGES.includes(lead.lifecycle_stage)) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('leads')
        .update({ lifecycle_stage: 'lost', lost_reason: `disqualified:${stage_key}`, stage_entered_at: now })
        .eq('id', id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

      await recordStageChange(supabase, id, {
        fromStage: lead.lifecycle_stage,
        toStage: 'lost',
        changedBy: 'admin',
        reason: `Disqualified: ${stage.label}`,
      });

      result.movedToLost = true;
      result.stage_entered_at = now;
    }
  }

  return NextResponse.json(result);
}
