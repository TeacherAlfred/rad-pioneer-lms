// Shared by the Capture Payment flow (earmarking at the moment cash comes
// in) and the retroactive Income earmark route (annotating a payment
// captured before this existed) - both ultimately do the same thing: for
// each allocation row, create the standing expense first if it's a freehand
// one (expense_id null), then log the note against the given capture batch.
// Purely a bookkeeping note - never touches invoices, invoice_payments.amount,
// or the actual cash-waterfall math.
export type ExpenseAllocationInput = {
  expense_id: string | null;
  name: string;
  amount: number;
  due_date?: string;
  payment_timing?: 'pre_paid' | 'post_paid';
  recurring?: boolean;
};

export async function insertExpenseAllocations(
  supabase: any,
  captureBatchId: string,
  allocations: ExpenseAllocationInput[] | undefined
) {
  for (const ea of allocations || []) {
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
}
