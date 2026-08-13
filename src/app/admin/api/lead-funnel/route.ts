import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role: leads has zero anon RLS policies since the 2026-08-12
// lockdown, so a browser-side client can no longer read this table directly.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

// Tags-only edit - currently just used to toggle the "Inhouse" tag (test/staff/
// teacher leads) so they can stay in the database for testing without
// polluting the funnel stats, which filter on that tag client-side.
export async function PATCH(req: Request) {
  try {
    const { id, tags } = await req.json();
    if (!id || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'id and tags[] are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ tags })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
