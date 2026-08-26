import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Separate question from the monthly Cash-in-Hand/Fully-Collected scenarios
// (which deliberately reset each month, for "did this month's own income
// cover this month's own priorities"): this is the actual cumulative bank
// position - opening balance, plus every month's (paid - obligations) from
// there through the requested month. Reordering priority within a month
// can flip which specific item shows covered/shortfall there, but it can't
// change this figure - it's a straight sum, not a priority walk.
function lineCostBasis(line: any, eventPackageById: Map<string, any>, costLinksByLine: Map<string, any[]>): number | null {
  const eventPackage = line.event_package_id ? eventPackageById.get(line.event_package_id) : null;
  if (eventPackage && eventPackage.computed_cost != null) {
    if (line.event_package_quantity !== null && line.event_package_quantity !== undefined) {
      const perUnitCost = Number(eventPackage.computed_cost) / Number(eventPackage.unit_multiplier || 1);
      return perUnitCost * Number(line.event_package_quantity);
    }
    return Number(eventPackage.computed_cost) * Number(line.quantity);
  }
  const links = costLinksByLine.get(line.id) || [];
  if (links.length > 0) {
    return links.reduce((sum: number, l: any) => sum + Number(l.quantity) * Number(l.inventory_item?.unit_cost || 0), 0);
  }
  return null;
}

function addMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const targetMonth = searchParams.get('month') || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const supabase = supabaseAdmin();
  const { data: settings } = await supabase.from('cash_running_balance_settings').select('*').limit(1).single();
  const openingBalance = Number(settings?.opening_balance || 0);
  const openingMonth = (settings?.opening_balance_date || now.toISOString().split('T')[0]).slice(0, 7);

  if (targetMonth < openingMonth) {
    return NextResponse.json({ error: `Opening balance starts ${openingMonth} - can't compute a running balance before that.` }, { status: 400 });
  }
  // Guards against an accidental far-past opening date turning this into a
  // very long loop - in practice this business has a handful of months of
  // data, not years.
  const MAX_MONTHS = 60;

  const [{ data: invoices }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('invoice_payments').select('*'),
    supabase.from('monthly_expenses').select('*').eq('active', true),
  ]);

  const quoteIds = [...new Set((invoices || []).map((i: any) => i.quote_id).filter(Boolean))];
  const { data: allLines } = quoteIds.length
    ? await supabase.from('quote_line_items').select('*').in('quote_id', quoteIds)
    : { data: [] as any[] };
  const eventPackageIds = [...new Set((allLines || []).map((l: any) => l.event_package_id).filter(Boolean))];
  const lineIds = (allLines || []).map((l: any) => l.id);
  const [{ data: eventPackages }, { data: costLinks }] = await Promise.all([
    eventPackageIds.length ? supabase.from('event_packages').select('id, computed_cost, unit_multiplier').in('id', eventPackageIds) : Promise.resolve({ data: [] as any[] }),
    lineIds.length
      ? supabase.from('quote_line_item_costs').select('*, inventory_item:inventory_items(unit_cost)').in('quote_line_item_id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const eventPackageById = new Map((eventPackages || []).map((e: any) => [e.id, e]));
  const costLinksByLine = new Map<string, any[]>();
  (costLinks || []).forEach((link: any) => {
    const arr = costLinksByLine.get(link.quote_line_item_id) || [];
    arr.push(link);
    costLinksByLine.set(link.quote_line_item_id, arr);
  });
  const linesByQuote = new Map<string, any[]>();
  (allLines || []).forEach((line: any) => {
    const arr = linesByQuote.get(line.quote_id) || [];
    arr.push(line);
    linesByQuote.set(line.quote_id, arr);
  });

  // Bucket obligations by the same delivery-month logic the monthly
  // waterfall uses (delivery_gated_on_payment / delivery_month override /
  // fall back to due_at's own month).
  const obligationsByMonth = new Map<string, number>();
  for (const inv of invoices || []) {
    if (inv.delivery_gated_on_payment && inv.status !== 'paid') continue;
    const monthKey: string = inv.delivery_month || String(inv.due_at).slice(0, 7);
    const lines = linesByQuote.get(inv.quote_id) || [];
    let total = 0;
    for (const line of lines) {
      const basis = lineCostBasis(line, eventPackageById, costLinksByLine);
      if (basis !== null) total += basis;
    }
    obligationsByMonth.set(monthKey, (obligationsByMonth.get(monthKey) || 0) + total);
  }
  for (const exp of expenses || []) {
    const monthKey = String(exp.due_date).slice(0, 7);
    obligationsByMonth.set(monthKey, (obligationsByMonth.get(monthKey) || 0) + Number(exp.amount));
  }

  const paidByMonth = new Map<string, number>();
  for (const p of payments || []) {
    const monthKey = String(p.received_at).slice(0, 7);
    paidByMonth.set(monthKey, (paidByMonth.get(monthKey) || 0) + Number(p.amount));
  }

  const breakdown: { month: string; paid: number; obligations: number; net: number; balanceAfter: number }[] = [];
  let balance = openingBalance;
  let cursor = openingMonth;
  let guard = 0;
  while (cursor <= targetMonth && guard < MAX_MONTHS) {
    const paid = paidByMonth.get(cursor) || 0;
    const obligations = obligationsByMonth.get(cursor) || 0;
    const net = paid - obligations;
    balance += net;
    breakdown.push({ month: cursor, paid, obligations, net, balanceAfter: balance });
    cursor = addMonthKey(cursor, 1);
    guard++;
  }

  return NextResponse.json({
    asOfMonth: targetMonth,
    openingBalance,
    openingMonth,
    runningBalance: balance,
    breakdown,
    truncated: guard >= MAX_MONTHS,
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
