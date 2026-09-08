import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Admin-internal companion to /api/finance-v2/leads/[id]/statement (the
// public, client-facing ledger): same two debit/credit sources - v2 invoices
// + any legacy balance-brought-forward - but keeps every layer separate and
// itemized (per-line-item detail from quote_line_items, not the collapsed
// "; "-joined description the public statement uses, plus payment status/
// method) instead of collapsing to one line per invoice. Deliberately
// excludes quotes - admin asked for invoices/payments only, not the pipeline
// that led to them. Returns full history; the page does its own year/quarter
// windowing client-side so switching periods needs no re-fetch.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;
  const supabase = supabaseAdmin();

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, name, phone, email, customer_type, company_name')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [{ data: invoices, error: invError }, { data: balanceForward }] = await Promise.all([
    supabase.from('invoices').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
    supabase.from('lead_balance_forward').select('*').eq('lead_id', leadId).maybeSingle(),
  ]);
  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

  const invoiceIds = (invoices || []).map((inv: any) => inv.id);
  const quoteIds = [...new Set((invoices || []).map((inv: any) => inv.quote_id).filter(Boolean))];
  const [{ data: payments }, { data: balanceForwardPayments }, { data: lineItemsRaw }] = await Promise.all([
    invoiceIds.length
      ? supabase.from('invoice_payments').select('*').in('invoice_id', invoiceIds).order('received_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    balanceForward
      ? supabase.from('lead_balance_forward_payments').select('*').eq('balance_forward_id', balanceForward.id).order('received_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    quoteIds.length
      ? supabase.from('quote_line_items').select('*').in('quote_id', quoteIds).order('sort_order')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const paymentsByInvoice = new Map<string, any[]>();
  (payments || []).forEach((p: any) => {
    const arr = paymentsByInvoice.get(p.invoice_id) || [];
    arr.push(p);
    paymentsByInvoice.set(p.invoice_id, arr);
  });
  const lineItemsByQuote = new Map<string, any[]>();
  (lineItemsRaw || []).forEach((li: any) => {
    const arr = lineItemsByQuote.get(li.quote_id) || [];
    arr.push(li);
    lineItemsByQuote.set(li.quote_id, arr);
  });

  const enrichedInvoices = (invoices || []).map((inv: any) => ({
    ...inv,
    outstanding: inv.status === 'cancelled' ? 0 : Math.max(0, Number(inv.amount) - Number(inv.amount_paid || 0)),
    payments: paymentsByInvoice.get(inv.id) || [],
    lineItems: inv.quote_id ? lineItemsByQuote.get(inv.quote_id) || [] : [],
  }));

  // Credited invoices are void - excluded from the totals (a written-off
  // invoice isn't "invoiced" any more than a cancelled order is a sale) even
  // though they're still returned in `invoices` below for the audit trail.
  const totalInvoiced =
    enrichedInvoices.filter((inv) => inv.status !== 'cancelled').reduce((s, inv) => s + Number(inv.amount), 0) +
    (balanceForward ? Number(balanceForward.amount) : 0);
  const totalPaid =
    (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0) +
    (balanceForwardPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

  return NextResponse.json({
    lead,
    invoices: enrichedInvoices,
    balanceForward: balanceForward ? { ...balanceForward, payments: balanceForwardPayments || [] } : null,
    totals: { invoiced: totalInvoiced, paid: totalPaid, outstanding: Math.max(0, totalInvoiced - totalPaid) },
  });
}
