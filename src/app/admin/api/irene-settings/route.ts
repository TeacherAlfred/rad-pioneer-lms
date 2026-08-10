import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lives under /admin so src/middleware.ts's existing auth guard (only the
// site owner gets past /admin/*) protects this route automatically — a
// route under plain /api/... would bypass that guard entirely.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const [{ data: settings, error: settingsErr }, { data: staffCode, error: staffErr }] = await Promise.all([
    supabaseAdmin.from('irene_settings').select('phase, educator_vote_weight, phase_ends_hint').eq('id', 1).single(),
    supabaseAdmin.from('irene_staff_codes').select('code').eq('id', 1).single(),
  ]);

  if (settingsErr || staffErr) {
    return NextResponse.json({ error: (settingsErr || staffErr)?.message }, { status: 500 });
  }

  return NextResponse.json({
    phase: settings.phase,
    educator_vote_weight: settings.educator_vote_weight,
    phase_ends_hint: settings.phase_ends_hint,
    staff_access_code: staffCode.code,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phase, educator_vote_weight, phase_ends_hint, staff_access_code } = body;

    const settingsUpdate: Record<string, any> = {};
    if (phase !== undefined) settingsUpdate.phase = phase;
    if (educator_vote_weight !== undefined) settingsUpdate.educator_vote_weight = educator_vote_weight;
    if (phase_ends_hint !== undefined) settingsUpdate.phase_ends_hint = phase_ends_hint || null;

    if (Object.keys(settingsUpdate).length > 0) {
      settingsUpdate.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin.from('irene_settings').update(settingsUpdate).eq('id', 1);
      if (error) throw error;
    }

    if (staff_access_code !== undefined) {
      const { error } = await supabaseAdmin
        .from('irene_staff_codes')
        .update({ code: staff_access_code, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
