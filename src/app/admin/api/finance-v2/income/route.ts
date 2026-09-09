import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// "Income" = every payment actually received - invoice_payments (allocated
// against a real v2 invoice) plus lead_balance_forward_payments (allocated
// against a legacy brought-forward balance, no v2 invoice involved). Kept as
// two separate source tables rather than one, so `allocated` can honestly
// show 0 for a balance-forward payment instead of inventing an invoice link
// that doesn't exist.
export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: invoicePayments, error: ipError }, { data: bfPayments, error: bfError }] = await Promise.all([
    supabase.from('invoice_payments').select('id, lead_id, invoice_id, amount, method, received_at, created_by, capture_batch_id').order('received_at', { ascending: false }),
    supabase.from('lead_balance_forward_payments').select('id, amount, received_at, note, balance_forward_id').order('received_at', { ascending: false }),
  ]);
  if (ipError) return NextResponse.json({ error: ipError.message }, { status: 500 });
  if (bfError) return NextResponse.json({ error: bfError.message }, { status: 500 });

  // Per-receipt earmarking notes (see income_expense_allocations) - a note
  // is against the whole capture batch (a receipt can be split across
  // several invoices), so it's attached to every row sharing that batch id.
  const batchIds = [...new Set((invoicePayments || []).map((p: any) => p.capture_batch_id).filter(Boolean))];
  const { data: earmarks } = batchIds.length
    ? await supabase.from('income_expense_allocations').select('id, capture_batch_id, expense_name, amount').in('capture_batch_id', batchIds)
    : { data: [] as any[] };
  const earmarksByBatch = new Map<string, { id: string; name: string; amount: number }[]>();
  (earmarks || []).forEach((e: any) => {
    const arr = earmarksByBatch.get(e.capture_batch_id) || [];
    arr.push({ id: e.id, name: e.expense_name, amount: Number(e.amount) });
    earmarksByBatch.set(e.capture_batch_id, arr);
  });

  const invoiceIds = [...new Set((invoicePayments || []).map((p: any) => p.invoice_id).filter(Boolean))];
  const balanceIds = [...new Set((bfPayments || []).map((p: any) => p.balance_forward_id).filter(Boolean))];

  const [{ data: invoices }, { data: balances }] = await Promise.all([
    invoiceIds.length ? supabase.from('invoices').select('id, invoice_number, lead_id').in('id', invoiceIds) : Promise.resolve({ data: [] as any[] }),
    balanceIds.length ? supabase.from('lead_balance_forward').select('id, lead_id').in('id', balanceIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const invoiceById = new Map((invoices || []).map((i: any) => [i.id, i]));
  const balanceById = new Map((balances || []).map((b: any) => [b.id, b]));

  const leadIds = new Set<string>();
  (invoicePayments || []).forEach((p: any) => p.lead_id && leadIds.add(p.lead_id));
  (bfPayments || []).forEach((p: any) => {
    const bal = balanceById.get(p.balance_forward_id);
    if (bal?.lead_id) leadIds.add(bal.lead_id);
  });
  const { data: leads } = leadIds.size
    ? await supabase.from('leads').select('id, name, phone, email, company_name').in('id', [...leadIds])
    : { data: [] as any[] };
  const leadById = new Map((leads || []).map((l: any) => [l.id, l]));

  const rows = [
    ...(invoicePayments || []).map((p: any) => {
      const inv = invoiceById.get(p.invoice_id);
      return {
        id: p.id,
        date: p.received_at,
        amount: Number(p.amount),
        allocated: Number(p.amount),
        invoiceId: p.invoice_id || null,
        invoiceRef: inv ? `INV-${inv.invoice_number}` : null,
        method: p.method,
        note: p.created_by,
        lead: leadById.get(p.lead_id) || null,
        earmarks: p.capture_batch_id ? earmarksByBatch.get(p.capture_batch_id) || [] : [],
        canEarmark: true,
      };
    }),
    ...(bfPayments || []).map((p: any) => {
      const bal = balanceById.get(p.balance_forward_id);
      return {
        id: p.id,
        date: p.received_at,
        amount: Number(p.amount),
        allocated: 0,
        invoiceId: null,
        invoiceRef: null,
        method: null,
        note: p.note,
        lead: bal ? leadById.get(bal.lead_id) || null : null,
        earmarks: [] as { id: string; name: string; amount: number }[],
        canEarmark: false,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ payments: rows });
}
