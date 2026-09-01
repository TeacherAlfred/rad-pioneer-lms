import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Partial update - edit any field, or just flip `archived` to archive/
// unarchive. No hard delete: "archive" is the removal mechanism, so a
// mis-archived item is always recoverable rather than gone.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { question, answer, link_url, link_label, sort_order, archived } = body as {
    question?: string;
    answer?: string;
    link_url?: string | null;
    link_label?: string | null;
    sort_order?: number;
    archived?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (question !== undefined) update.question = question.trim();
  if (answer !== undefined) update.answer = answer.trim();
  if (link_url !== undefined) update.link_url = link_url?.trim() || null;
  if (link_label !== undefined) update.link_label = link_label?.trim() || null;
  if (sort_order !== undefined) update.sort_order = sort_order;
  if (archived !== undefined) update.archived = archived === true;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('irene_fitness_faq_items').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
