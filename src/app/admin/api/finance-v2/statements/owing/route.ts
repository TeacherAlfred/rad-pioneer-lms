import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Feeds the Statements left-panel entry: "which leads currently owe money,"
// aggregated across the same two debit sources /api/finance-v2/leads/[id]/statement
// itself reads (unpaid v2 invoices + any legacy balance-brought-forward row).
export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: invoices, error: invError }, { data: balances, error: balError }] = await Promise.all([
    supabase.from('invoices').select('lead_id, amount, amount_paid, due_at, status').not('status', 'in', '(paid,cancelled)'),
    supabase.from('lead_balance_forward').select('id, lead_id, amount, as_of_date'),
  ]);
  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });
  if (balError) return NextResponse.json({ error: balError.message }, { status: 500 });

  const balanceIds = (balances || []).map((b: any) => b.id);
  const { data: balancePayments } = balanceIds.length
    ? await supabase.from('lead_balance_forward_payments').select('balance_forward_id, amount').in('balance_forward_id', balanceIds)
    : { data: [] as any[] };
  const paidByBalance = new Map<string, number>();
  (balancePayments || []).forEach((p: any) => {
    paidByBalance.set(p.balance_forward_id, (paidByBalance.get(p.balance_forward_id) || 0) + Number(p.amount));
  });

  const owingByLead = new Map<string, { outstanding: number; invoiceCount: number; oldestDue: string | null }>();
  function bump(leadId: string | null, amount: number, dueDate: string | null, countsAsInvoice: boolean) {
    if (!leadId || amount <= 0) return;
    const entry = owingByLead.get(leadId) || { outstanding: 0, invoiceCount: 0, oldestDue: null };
    entry.outstanding += amount;
    if (countsAsInvoice) entry.invoiceCount += 1;
    if (dueDate && (!entry.oldestDue || dueDate < entry.oldestDue)) entry.oldestDue = dueDate;
    owingByLead.set(leadId, entry);
  }

  (invoices || []).forEach((inv: any) => {
    bump(inv.lead_id, Math.max(0, Number(inv.amount) - Number(inv.amount_paid || 0)), inv.due_at, true);
  });
  (balances || []).forEach((b: any) => {
    bump(b.lead_id, Math.max(0, Number(b.amount) - (paidByBalance.get(b.id) || 0)), b.as_of_date, false);
  });

  const leadIds = [...owingByLead.keys()];
  const { data: leads } = leadIds.length
    ? await supabase.from('leads').select('id, name, phone, email, company_name').in('id', leadIds)
    : { data: [] as any[] };
  const leadById = new Map((leads || []).map((l: any) => [l.id, l]));

  const owing = leadIds
    .map((leadId) => ({ lead: leadById.get(leadId) || null, ...owingByLead.get(leadId)! }))
    .filter((r) => r.lead && r.outstanding > 0.01)
    .sort((a, b) => b.outstanding - a.outstanding);

  return NextResponse.json({ owing });
}
