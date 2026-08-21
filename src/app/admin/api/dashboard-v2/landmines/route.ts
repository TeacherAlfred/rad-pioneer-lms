import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('landmines').select('*').order('title');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ landmines: data || [] });
}
