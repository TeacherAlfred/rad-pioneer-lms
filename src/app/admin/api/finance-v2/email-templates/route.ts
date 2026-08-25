import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug');
  const supabase = supabaseAdmin();

  // No slug: list every template (id/slug/name) for a picker, e.g. the
  // featured-programs "Packages & Quote Email" section.
  if (!slug) {
    const { data, error } = await supabase.from('email_templates').select('id, slug, name').order('name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data || [] });
  }

  const { data, error } = await supabase.from('email_templates').select('body_content').eq('slug', slug).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ body_content: data?.body_content || '' });
}
