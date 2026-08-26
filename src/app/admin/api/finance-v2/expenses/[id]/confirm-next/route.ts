import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().split('T')[0];
}

// Materializes next month's instance of a recurring expense - only ever
// called explicitly from the confirmation prompt on /admin/finance-v2/
// expenses. Nothing creates this row on its own; "recurring" describes the
// expense's nature, not permission to auto-generate rows unattended (same
// prompt-don't-auto-switch discipline as elsewhere in this system).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: source, error: fetchError } = await supabase.from('monthly_expenses').select('*').eq('id', id).single();
  if (fetchError || !source) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  if (!source.recurring) return NextResponse.json({ error: 'This expense is not marked recurring' }, { status: 400 });

  const nextDueDate = addOneMonth(source.due_date);
  const { data: existing } = await supabase.from('monthly_expenses').select('id').eq('name', source.name).eq('due_date', nextDueDate).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Next month\'s instance already exists' }, { status: 400 });

  const { data: created, error } = await supabase
    .from('monthly_expenses')
    .insert({
      name: source.name,
      amount: source.amount,
      due_date: nextDueDate,
      payment_timing: source.payment_timing,
      recurring: true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: created });
}
