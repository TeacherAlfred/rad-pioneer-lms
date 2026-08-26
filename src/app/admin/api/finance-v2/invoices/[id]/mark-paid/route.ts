import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Reconciliation, not a new payment: for an invoice that turns out to have
// already been settled through some other channel (a past bulk payment, a
// migrated legacy record, etc.) and just needs the system corrected to
// match reality. Deliberately does NOT insert an invoice_payments row -
// that table drives the Cash Waterfall's "Paid this month" figure (sum of
// payments actually received this month), and this money didn't land this
// month - it already landed, earlier, uncounted. Flipping status/amount_
// paid here is what actually removes it from "still needs collecting" in
// the Due tracker and the Fully-Collected waterfall scenario, which is the
// whole point.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = supabaseAdmin();
  const { data: invoice, error: fetchError } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (fetchError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status === 'paid') return NextResponse.json({ error: 'Invoice is already marked paid' }, { status: 400 });

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'paid', amount_paid: invoice.amount, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
