import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Toggles a response's QA sign-off. [id] is the response id (irene_fitness_
// responses.id), not the family id the response table row list is otherwise
// keyed by admin-side. Gates the public feed and vote route (see
// api/irene-fitness/feed and api/irene-fitness/vote) - a response with
// typos or too little content to stand on its own can be un-confirmed here
// without touching consent.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { qa_confirmed } = body as { qa_confirmed?: boolean };
  if (typeof qa_confirmed !== 'boolean') {
    return NextResponse.json({ error: 'qa_confirmed must be a boolean' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('irene_fitness_responses')
    .update({ qa_confirmed, qa_confirmed_at: qa_confirmed ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
