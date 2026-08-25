import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdminOfRegistration } from '@/lib/registerInterest';

// Public - the quote page's "Request a change" action (spec §11), replacing
// a hard decline. Real by design: sets needs_human so it surfaces on the
// admin lead-funnel list exactly like any other needs-a-human flag, and
// fires the same WhatsApp alert path as a new registration - a "request a
// change" that doesn't reach a person defeats the entire point of not
// having a decline button.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { message } = await request.json();

  const supabase = supabaseAdmin();
  const { data: quote, error: quoteErr } = await supabase.from('quotes').select('id, quote_number, lead_id').eq('id', id).single();
  if (quoteErr || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

  const { error: leadErr } = await supabase.from('leads').update({ needs_human: true }).eq('id', quote.lead_id);
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });

  await notifyAdminOfRegistration(
    supabase,
    quote.lead_id,
    `✏️ Requested a change on Quote #${quote.quote_number}.\n${message ? `"${String(message).trim()}"` : '(no message given)'}`
  );

  return NextResponse.json({ ok: true });
}
