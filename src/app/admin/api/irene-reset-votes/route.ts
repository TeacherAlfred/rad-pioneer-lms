import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lives under /admin so src/middleware.ts's existing auth guard (only the
// site owner gets past /admin/*) protects this route automatically.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Destructive - wipes every vote and voter. Re-checked here server-side
// (not just disabled in the UI) so a stale page or a bypassed client can't
// wipe real votes once the campaign is live.
export async function POST() {
  try {
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('irene_settings')
      .select('phase')
      .eq('id', 1)
      .single();
    if (settingsErr) throw settingsErr;

    if (settings.phase !== 'setup') {
      return NextResponse.json(
        { error: 'Reset is locked once voting has started. Set the phase back to Setup first if this is really intended.' },
        { status: 403 }
      );
    }

    // Votes first - irene_votes.voter_id references irene_voters.id.
    const { error: votesErr } = await supabaseAdmin.from('irene_votes').delete().not('id', 'is', null);
    if (votesErr) throw votesErr;

    const { error: votersErr } = await supabaseAdmin.from('irene_voters').delete().not('id', 'is', null);
    if (votersErr) throw votersErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
