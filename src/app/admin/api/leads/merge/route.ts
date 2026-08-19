import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Executes the merge_leads() Postgres function (see
// 20260821150000_lead_merge.sql) - all the actual field-merging and FK
// repointing logic lives there so it runs as one atomic transaction rather
// than a sequence of separate supabase-js calls that could partially fail.
export async function POST(req: Request) {
  try {
    const { survivorId, loserId, fields } = await req.json();
    if (!survivorId || !loserId) {
      return NextResponse.json({ error: 'survivorId and loserId are required' }, { status: 400 });
    }
    if (survivorId === loserId) {
      return NextResponse.json({ error: 'Cannot merge a lead into itself' }, { status: 400 });
    }

    const { data: pair, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('id, merged_into_id')
      .in('id', [survivorId, loserId]);
    if (fetchErr) throw fetchErr;
    if (!pair || pair.length !== 2) {
      return NextResponse.json({ error: 'One or both leads could not be found.' }, { status: 404 });
    }
    if (pair.some(l => l.merged_into_id)) {
      return NextResponse.json({ error: 'One of these leads has already been merged into another record.' }, { status: 409 });
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('merge_leads', {
      p_survivor_id: survivorId,
      p_loser_id: loserId,
      p_fields: fields || {},
    });
    if (rpcErr) throw rpcErr;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
