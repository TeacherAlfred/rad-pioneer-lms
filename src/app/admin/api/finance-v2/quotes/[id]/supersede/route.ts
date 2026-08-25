import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Called after the Composer has already saved the replacement quote
// (?supersede=<id> prefill flow) - this just closes the loop by marking the
// original as superseded and pointing it at its replacement, using the
// superseded_by_quote_id column that already existed on quotes for exactly
// this.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { newQuoteId } = body;
  if (!newQuoteId) return NextResponse.json({ error: 'newQuoteId is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: quote, error: fetchError } = await supabase.from('quotes').select('status').eq('id', id).single();
  if (fetchError || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  if (quote.status === 'superseded') return NextResponse.json({ error: 'Quote is already superseded' }, { status: 400 });

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'superseded', superseded_by_quote_id: newQuoteId })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
