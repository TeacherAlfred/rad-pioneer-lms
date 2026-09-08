import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Writes off an invoice with nothing left to collect - e.g. one left behind
// when its quote got superseded and a replacement invoice was raised instead
// (quotes/[id]/supersede never touches already-created invoices). Distinct
// from mark-paid: this is "nothing owed, no cash involved" rather than
// "money landed outside the system." Sets status='cancelled' - the existing
// invoices_status_check constraint already allows it, so this needed no
// constraint migration, just the credited_at/credit_reason columns to carry
// why. Distinct from 'paid' so every "is this still outstanding" check
// across AR/cash-waterfall/statements can exclude it while Income/revenue
// reporting - which reads invoice_payments, never invoice.status - stays
// untouched, since crediting never writes a payment row.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = (body.reason || '').trim();
  if (!reason) return NextResponse.json({ error: 'A reason is required to credit an invoice' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: invoice, error: fetchError } = await supabase.from('invoices').select('id, status').eq('id', id).single();
  if (fetchError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status === 'paid') return NextResponse.json({ error: 'This invoice is already fully paid - nothing left to credit' }, { status: 400 });
  if (invoice.status === 'cancelled') return NextResponse.json({ error: 'This invoice has already been credited' }, { status: 400 });

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled', credited_at: new Date().toISOString(), credit_reason: reason })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
