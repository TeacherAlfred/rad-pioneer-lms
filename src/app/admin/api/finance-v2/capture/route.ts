import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ExpenseAllocationInput = {
  expense_id: string | null; // null => create a new standing expense from name/due_date/etc below
  name: string;
  amount: number;
  due_date?: string;
  payment_timing?: 'pre_paid' | 'post_paid';
  recurring?: boolean;
};

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
    // touches the invoices/waterfall math above. A row with expense_id=null
    // creates the standing expense first (same defaults as the Standing
    // Expenses "add" form), so a one-off freehand note becomes a real,
    // trackable expense rather than disappearing after this capture.
    for (const ea of expense_allocations || []) {
      if (!ea.amount || ea.amount <= 0 || !ea.name?.trim()) continue;

      let expenseId = ea.expense_id;
      if (!expenseId) {
        if (!ea.due_date) continue;
        const { data: newExpense, error: expError } = await supabase
          .from('monthly_expenses')
          .insert({
            name: ea.name.trim(),
            amount: ea.amount,
            due_date: ea.due_date,
            payment_timing: ea.payment_timing === 'pre_paid' ? 'pre_paid' : 'post_paid',
            recurring: !!ea.recurring,
          })
          .select('id')
          .single();
        if (expError) throw expError;
        expenseId = newExpense.id;
      }

      const { error: allocError } = await supabase.from('income_expense_allocations').insert({
        capture_batch_id: captureBatchId,
        expense_id: expenseId,
        expense_name: ea.name.trim(),
        amount: ea.amount,
      });
      if (allocError) throw allocError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
