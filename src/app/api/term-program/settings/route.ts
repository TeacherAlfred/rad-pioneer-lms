import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public counterpart to /admin/api/term-program-settings. dashboard_settings
// as a whole is RLS-locked (it also holds business thresholds/audit notes),
// so the public /term-program page can't read it directly with the anon
// client - this route exposes only the five term-program marketing-copy
// columns via the service role, nothing else on that row.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('dashboard_settings')
    .select('term_program_hero_title, term_program_hero_subtitle, term_program_hero_image_url, term_program_sessions_heading, term_program_tbc_deadline_label')
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
