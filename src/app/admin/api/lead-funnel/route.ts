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
