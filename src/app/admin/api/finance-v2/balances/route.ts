import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data: balances, error } = await supabase
    .from('lead_balance_forward')
    .select('*, lead:leads(id, name, phone, email, company_name)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (balances || []).map((b: any) => b.id);
  const { data: payments } = ids.length
    ? await supabase.from('lead_balance_forward_payments').select('*').in('balance_forward_id', ids).order('received_at', { ascending: true })
    : { data: [] as any[] };
  const paymentsByBalance = new Map<string, any[]>();
  (payments || []).forEach((p: any) => {
    const arr = paymentsByBalance.get(p.balance_forward_id) || [];
    arr.push(p);
    paymentsByBalance.set(p.balance_forward_id, arr);
  });

  const enriched = (balances || []).map((b: any) => {
    const pmts = paymentsByBalance.get(b.id) || [];
    const paid = pmts.reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { ...b, payments: pmts, paid, outstanding: Math.max(0, Number(b.amount) - paid) };
  });

  return NextResponse.json({ balances: enriched });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { lead_id, amount, as_of_date, legacy_reference, description } = body;
  if (!lead_id || !amount || Number(amount) <= 0 || !as_of_date) {
    return NextResponse.json({ error: 'lead_id, amount (positive), and as_of_date are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from('lead_balance_forward').select('id').eq('lead_id', lead_id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'This lead already has a brought-forward balance — edit the existing one instead.' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('lead_balance_forward')
    .insert({
      lead_id,
      amount,
      as_of_date,
      legacy_reference: legacy_reference || null,
      description: description || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ balance: data });
}
