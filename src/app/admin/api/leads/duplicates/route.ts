import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Flagged possible-duplicate pairs (lead_duplicate_candidates - see
// 20260925170000_lead_duplicate_candidates.sql). Re-scans on every load so
// duplicates created since the last visit (e.g. a WhatsApp message from an
// imported 0738... contact creating a fresh 27738... lead) show up without
// a cron. Only flags - merging stays manual on /admin/lead-funnel/merge.
export async function GET() {
  try {
    const { error: refreshErr } = await supabaseAdmin.rpc('refresh_lead_duplicate_candidates');
    if (refreshErr) throw refreshErr;

    const { data, error } = await supabaseAdmin
      .from('lead_duplicate_candidates')
      .select('id, lead_a_id, lead_b_id, reason, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ pairs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// "Not a duplicate" - stays dismissed on later refreshes.
export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('lead_duplicate_candidates')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
