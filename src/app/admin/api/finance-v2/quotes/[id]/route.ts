import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Manual status correction only - 'accepted' (creates invoices + flips lead
// lifecycle) and 'superseded' (must link to its replacement quote) each have
// real side effects and go through their own dedicated routes instead, so a
// plain status edit here can never leave those invariants half-applied.
const MANUAL_STATUSES = ['sent', 'declined', 'expired'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!MANUAL_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${MANUAL_STATUSES.join(', ')}` }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: quote, error: fetchError } = await supabase.from('quotes').select('status').eq('id', id).single();
  if (fetchError || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  if (quote.status === 'accepted' || quote.status === 'superseded') {
    return NextResponse.json({ error: `Cannot manually change status of a quote that is already ${quote.status}` }, { status: 400 });
  }

  const { error } = await supabase.from('quotes').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
