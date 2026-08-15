import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ?sessionId= scopes to one session (the normal case); omitted, returns
// held reviews across all sessions - the founder's "what needs my
// attention" view.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const heldOnly = searchParams.get('heldOnly') === 'true';

  let query = supabaseAdmin
    .from('session_reviews')
    .select('*, kids(id, name), sessions(id, starts_at, programme_id, programs(id, code, name))')
    .order('submitted_at', { ascending: false });
  if (sessionId) query = query.eq('session_id', sessionId);
  if (heldOnly) query = query.eq('hold_status', 'held');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Release a held review (spec 5: "the founder reviews, decides whether
// to phone first, and releases the message manually"). No auto-send is
// wired up yet - this just marks it approved for whenever delivery
// automation exists.
export async function PATCH(req: Request) {
  try {
    const { id, hold_status, released_by } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (hold_status && !['none', 'held', 'released'].includes(hold_status)) {
      return NextResponse.json({ error: 'invalid hold_status' }, { status: 400 });
    }
    const update: Record<string, any> = {};
    if (hold_status) {
      update.hold_status = hold_status;
      if (hold_status === 'released') {
        update.released_at = new Date().toISOString();
        update.released_by = released_by || null;
      }
    }
    const { data, error } = await supabaseAdmin
      .from('session_reviews')
      .update(update)
      .eq('id', id)
      .select('*, kids(id, name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
