import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { amount, received_at, note } = body;
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount (positive) is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('lead_balance_forward_payments')
    .insert({
      balance_forward_id: id,
      amount,
      received_at: received_at || new Date().toISOString().split('T')[0],
      note: note || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}
