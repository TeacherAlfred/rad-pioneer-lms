import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { QUALIFICATION_STAGES } from '@/lib/leadQualification';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { stage_key, passed, notes } = body as { stage_key: string; passed: boolean; notes?: string };

  if (!QUALIFICATION_STAGES.some((s) => s.key === stage_key)) {
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
  return NextResponse.json({ ok: true });
}
