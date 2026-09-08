import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { insertExpenseAllocations, type ExpenseAllocationInput } from '@/lib/incomeExpenseAllocations';

// Retroactive version of the earmarking done at Capture Payment time - for
// a payment received before this existed (or one that just wasn't marked
// yet). `id` here is an invoice_payments row. Its capture_batch_id is
// usually null for anything old, so this backfills one scoped to just this
// single row - there's no reliable way to reconstruct which other rows,
// if any, were part of the same original receipt.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { expense_allocations } = body as { expense_allocations: ExpenseAllocationInput[] };
  if (!Array.isArray(expense_allocations) || expense_allocations.length === 0) {
    return NextResponse.json({ error: 'expense_allocations is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: payment, error: fetchError } = await supabase
    .from('invoice_payments')
    .select('id, amount, capture_batch_id')
    .eq('id', id)
    .single();
  if (fetchError || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  let batchId: string = payment.capture_batch_id;
  if (!batchId) {
    batchId = crypto.randomUUID();
    const { error: updError } = await supabase.from('invoice_payments').update({ capture_batch_id: batchId }).eq('id', id);
    if (updError) return NextResponse.json({ error: updError.message }, { status: 500 });
  }

  const { data: existing } = await supabase.from('income_expense_allocations').select('amount').eq('capture_batch_id', batchId);
  const alreadyEarmarked = (existing || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const incoming = expense_allocations.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  if (alreadyEarmarked + incoming > Number(payment.amount) + 0.01) {
    return NextResponse.json(
      { error: `Earmarking R${(alreadyEarmarked + incoming).toFixed(2)} would exceed the R${Number(payment.amount).toFixed(2)} actually received in this payment` },
      { status: 400 }
    );
  }

  try {
    await insertExpenseAllocations(supabase, batchId, expense_allocations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
