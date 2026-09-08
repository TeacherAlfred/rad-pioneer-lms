import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { insertExpenseAllocations, type ExpenseAllocationInput } from '@/lib/incomeExpenseAllocations';

export async function POST(request: Request) {
  const body = await request.json();
  const { lead_id, allocations, method, reference, received_at, expense_allocations } = body as {
    lead_id: string;
    allocations: Record<string, number>;
    method: string;
    reference?: string;
    received_at: string;
    expense_allocations?: ExpenseAllocationInput[];
  };

  if (!lead_id || !allocations || !method || !received_at) {
    return NextResponse.json({ error: 'lead_id, allocations, method, and received_at are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  try {
    // Shared by every invoice_payments row this call writes, so a single
    // receipt split across several invoices can still be earmarked as one
    // whole against a standing expense below, not per arbitrary invoice.
    const captureBatchId = crypto.randomUUID();

    for (const [invoiceId, amount] of Object.entries(allocations)) {
      if (!amount || amount <= 0) continue;

      const { data: invoice, error: invFetchError } = await supabase
        .from('invoices')
        .select('amount, amount_paid')
        .eq('id', invoiceId)
        .single();
      if (invFetchError) throw invFetchError;

      const { error: payError } = await supabase.from('invoice_payments').insert([{
        invoice_id: invoiceId,
        lead_id,
        amount,
        method,
        received_at,
        created_by: reference ? `manual: ${reference}` : 'manual',
        capture_batch_id: captureBatchId,
      }]);
      if (payError) throw payError;

      const newPaidAmt = Number(invoice.amount_paid || 0) + amount;
      const isFullyPaid = newPaidAmt >= Number(invoice.amount);
      const { error: updError } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaidAmt, status: isFullyPaid ? 'paid' : 'partially_paid', paid_at: isFullyPaid ? received_at : null })
        .eq('id', invoiceId);
      if (updError) throw updError;
    }

    // Purely a bookkeeping note ("this money covered such and such") - never
    // touches the invoices/waterfall math above.
    await insertExpenseAllocations(supabase, captureBatchId, expense_allocations);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
