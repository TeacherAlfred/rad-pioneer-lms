import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// /term-program's own hero/section copy - see /api/term-program/settings
// (the public counterpart the page itself reads) and term-program/page.tsx,
// which fall back to built-in default text when these are unset. Single
// implicit settings row, same convention as every other dashboard_settings
// field (welcome_message_new etc.).
const FIELDS = 'term_program_hero_title, term_program_hero_subtitle, term_program_hero_image_url, term_program_sessions_heading, term_program_tbc_deadline_label';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('dashboard_settings').select(FIELDS).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      term_program_hero_title, term_program_hero_subtitle, term_program_hero_image_url,
      term_program_sessions_heading, term_program_tbc_deadline_label,
    } = body;

    const supabase = supabaseAdmin();
    const { data: existing } = await supabase.from('dashboard_settings').select('id').limit(1).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'dashboard_settings has no row to update' }, { status: 500 });

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (term_program_hero_title !== undefined) update.term_program_hero_title = term_program_hero_title?.trim() || null;
    if (term_program_hero_subtitle !== undefined) update.term_program_hero_subtitle = term_program_hero_subtitle?.trim() || null;
    if (term_program_hero_image_url !== undefined) update.term_program_hero_image_url = term_program_hero_image_url?.trim() || null;
    if (term_program_sessions_heading !== undefined) update.term_program_sessions_heading = term_program_sessions_heading?.trim() || null;
    if (term_program_tbc_deadline_label !== undefined) update.term_program_tbc_deadline_label = term_program_tbc_deadline_label?.trim() || null;

    const { data, error } = await supabase
      .from('dashboard_settings')
      .update(update)
      .eq('id', existing.id)
      .select(FIELDS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
