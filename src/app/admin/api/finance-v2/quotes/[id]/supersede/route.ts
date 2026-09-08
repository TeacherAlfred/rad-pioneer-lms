import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Called after the Composer has already saved the replacement quote
// (?supersede=<id> prefill flow) - this just closes the loop by marking the
// original as superseded and pointing it at its replacement, using the
// superseded_by_quote_id column that already existed on quotes for exactly
// this. Deliberately does NOT touch any invoice already raised against the
// original quote (that's how INV-27 was left dangling, still due, after its
// quote was superseded by QT-35/INV-28) - instead it hands back those
// invoices so the Composer can ask the admin whether to credit them. Nothing
// here decides that on its own.
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

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, amount_paid, status')
    .eq('quote_id', id)
    .not('status', 'in', '(paid,cancelled)');

  return NextResponse.json({ ok: true, invoices: invoices || [] });
}
