import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Admin-only - protected by the /admin/* prefix middleware, same as every
// other route under src/app/admin/api/*. `programs` has zero anon RLS
// policies, so this must run server-side with the service-role key.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('programs').select('id, code, name').eq('active', true).order('code');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ programs: data || [] });
}
