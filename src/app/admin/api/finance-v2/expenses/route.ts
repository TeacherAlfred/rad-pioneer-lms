import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('monthly_expenses').select('*').order('due_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, amount, due_date, payment_timing, recurring } = body;
  if (!name || !amount || !due_date) {
    return NextResponse.json({ error: 'name, amount, and due_date are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('monthly_expenses')
    .insert({
      name,
      amount,
      due_date,
      payment_timing: payment_timing === 'pre_paid' ? 'pre_paid' : 'post_paid',
      recurring: !!recurring,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
