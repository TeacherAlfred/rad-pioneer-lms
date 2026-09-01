import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Full list (including archived) - the admin UI needs to see archived items
// to unarchive them, unlike the public /api/irene-fitness/faq route.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_faq_items')
    .select('id, question, answer, link_url, link_label, sort_order, archived')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { question, answer, link_url, link_label, sort_order } = body as {
    question?: string;
    answer?: string;
    link_url?: string | null;
    link_label?: string | null;
    sort_order?: number;
  };
  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: 'question and answer are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_faq_items')
    .insert([{
      question: question.trim(),
      answer: answer.trim(),
      link_url: link_url?.trim() || null,
      link_label: link_label?.trim() || null,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
    }])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
