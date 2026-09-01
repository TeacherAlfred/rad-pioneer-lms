import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public, read-only - the admin-managed FAQ list (question/answer/optional
// link), archived items excluded. Opt-out and "ask us" are deliberately NOT
// here - they're fixed affordances in the FAQ modal shell itself, so they
// can't be edited or archived away by mistake.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_faq_items')
    .select('id, question, answer, link_url, link_label')
    .eq('archived', false)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
