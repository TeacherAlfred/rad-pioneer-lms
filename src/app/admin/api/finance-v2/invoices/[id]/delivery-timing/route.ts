import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Decouples "when does the client need to pay" (due_at, untouched) from
// "when does the cost of actually delivering this get incurred" - a
// workshop instalment can be due in one month for a workshop running in
// another, and some services don't start until the invoice is paid at
// all, with the start month only a tentative plan until then.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { delivery_month, delivery_gated_on_payment } = body;

  if (delivery_month !== undefined && delivery_month !== null && !/^\d{4}-\d{2}$/.test(delivery_month)) {
    return NextResponse.json({ error: 'delivery_month must be in YYYY-MM format' }, { status: 400 });
  }

  const update: Record<string, any> = {};
  if (delivery_month !== undefined) update.delivery_month = delivery_month || null;
  if (delivery_gated_on_payment !== undefined) update.delivery_gated_on_payment = !!delivery_gated_on_payment;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('invoices').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
