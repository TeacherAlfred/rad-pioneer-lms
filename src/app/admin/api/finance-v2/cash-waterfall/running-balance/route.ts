import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeRunningBalanceThrough } from '@/lib/cashWaterfall';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const targetMonth = searchParams.get('month') || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const supabase = supabaseAdmin();
  const result = await computeRunningBalanceThrough(supabase, targetMonth);
  if (!result.reachedTarget) {
    return NextResponse.json({ error: `Opening balance starts ${result.openingMonth} - can't compute a running balance before that.` }, { status: 400 });
  }

  return NextResponse.json({
    asOfMonth: targetMonth,
    openingBalance: result.openingBalance,
    openingMonth: result.openingMonth,
    runningBalance: result.balance,
    breakdown: result.breakdown,
    truncated: result.truncated,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { opening_balance, opening_balance_date } = body;
  if (opening_balance === undefined || !opening_balance_date) {
    return NextResponse.json({ error: 'opening_balance and opening_balance_date are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from('cash_running_balance_settings').select('id').limit(1).single();
  if (!existing) return NextResponse.json({ error: 'Settings row not found' }, { status: 500 });

  const { data, error } = await supabase
    .from('cash_running_balance_settings')
    .update({ opening_balance: Number(opening_balance), opening_balance_date, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
