import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const programId = new URL(request.url).searchParams.get('programId');
  if (!programId) return NextResponse.json({ error: 'programId is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, starts_at, price')
    .eq('programme_id', programId)
    .order('starts_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data || [] });
}
