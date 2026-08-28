import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public, unauthenticated - same security model as /api/finance-v2/invoices/[id]
// and /quote-v2, /invoice-v2: the lead id itself is the shared link. Builds
// one chronological ledger (balance brought forward + all v2 invoices as
// debits, all payments as credits) with a running balance, mirroring the
// legacy /statement/[id] computation but re-sourced from v2 tables.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;
  const supabase = supabaseAdmin();

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, name, phone, email, customer_type, company_name')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [{ data: balanceForward }, { data: invoices }] = await Promise.all([
    supabase.from('lead_balance_forward').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('invoices').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
  ]);

  const balanceForwardPayments = balanceForward
    ? (await supabase.from('lead_balance_forward_payments').select('*').eq('balance_forward_id', balanceForward.id)).data || []
    : [];

  const quoteIds = [...new Set((invoices || []).map((i: any) => i.quote_id).filter(Boolean))];
  const invoiceIds = (invoices || []).map((i: any) => i.id);
  const [{ data: lineItems }, { data: invoicePayments }] = await Promise.all([
    quoteIds.length ? supabase.from('quote_line_items').select('*').in('quote_id', quoteIds).order('sort_order') : Promise.resolve({ data: [] as any[] }),
    invoiceIds.length ? supabase.from('invoice_payments').select('*').in('invoice_id', invoiceIds).order('received_at', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
  ]);

  const linesByQuote = new Map<string, any[]>();
  (lineItems || []).forEach((li: any) => {
    const arr = linesByQuote.get(li.quote_id) || [];
    arr.push(li);
    linesByQuote.set(li.quote_id, arr);
  });

  const rawTransactions: { type: 'debit' | 'credit'; dateObj: Date; date: string; ref: string; desc: string; debit: number | null; credit: number | null }[] = [];

  if (balanceForward) {
    const dateObj = new Date(balanceForward.as_of_date + 'T00:00:00');
    rawTransactions.push({
      type: 'debit',
      dateObj,
      date: dateObj.toLocaleDateString('en-ZA'),
      ref: balanceForward.legacy_reference || 'Balance B/F',
      desc: balanceForward.description || 'Balance brought forward',
      debit: Number(balanceForward.amount),
      credit: null,
    });
    for (const p of balanceForwardPayments) {
      const pDate = new Date(p.received_at + 'T00:00:00');
      rawTransactions.push({
        type: 'credit',
        dateObj: pDate,
        date: pDate.toLocaleDateString('en-ZA'),
        ref: 'Payment',
        desc: p.note || 'Payment against balance brought forward',
        debit: null,
        credit: Number(p.amount),
      });
    }
  }

  for (const inv of invoices || []) {
    const dateObj = new Date(inv.created_at);
    const lines = linesByQuote.get(inv.quote_id) || [];
    const desc = lines.length > 0 ? lines.map((l: any) => l.description).filter(Boolean).join('; ') : `Instalment #${inv.sequence_number}`;
    rawTransactions.push({
      type: 'debit',
      dateObj,
      date: dateObj.toLocaleDateString('en-ZA'),
      ref: `INV-${inv.invoice_number}`,
      desc: desc || 'Account Charge',
      debit: Number(inv.amount),
      credit: null,
    });
  }

  for (const p of invoicePayments || []) {
    const dateObj = new Date(p.received_at);
    rawTransactions.push({
      type: 'credit',
      dateObj,
      date: dateObj.toLocaleDateString('en-ZA'),
      ref: `Payment (${p.method || 'manual'})`,
      desc: 'Payment received',
      debit: null,
      credit: Number(p.amount),
    });
  }

  rawTransactions.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  let runningBalance = 0;
  const transactions = rawTransactions.map((t) => {
    runningBalance += t.debit ? t.debit : -(t.credit || 0);
    return { date: t.date, ref: t.ref, desc: t.desc, debit: t.debit, credit: t.credit };
  });

  return NextResponse.json({ lead, transactions, balanceDue: runningBalance });
}
