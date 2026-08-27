import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Pause/resume/cancel a plan, or edit its cached amount/line items/cadence.
// Regenerating an invoice from the plan is a separate action - see ./generate.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { status, line_items, total_amount, next_due_date, notes } = body;

  if (status && !['active', 'paused', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'status must be active, paused, or cancelled' }, { status: 400 });
  }

  const update: {
    updated_at: string;
    status?: string;
    line_items?: unknown[];
    total_amount?: number;
    next_due_date?: string;
    notes?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (status !== undefined) update.status = status;
  if (line_items !== undefined) update.line_items = line_items;
  if (total_amount !== undefined) update.total_amount = total_amount;
  if (next_due_date !== undefined) update.next_due_date = next_due_date;
  if (notes !== undefined) update.notes = notes;

  const supabase = supabaseAdmin();
  const { data: plan, error } = await supabase
    .from('recurring_billing_plans')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan });
}
