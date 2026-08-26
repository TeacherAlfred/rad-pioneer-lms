// Shared by /admin/api/finance-v2/cash-waterfall and its running-balance
// sibling - both need the same month-bucketing and cost-resolution logic,
// and (as of this fix) the main route needs the running balance itself:
// Cash-in-Hand's available cash has to be the real cumulative bank
// position entering the month, not just that month's fresh receipts reset
// to R0 - otherwise a family's payment landing in an earlier month (like
// INV-8's July payment) is invisible to August's shortfall check even
// though it likely already funded that exact delivery cost.

// RAD Academy runs on SAST (UTC+2, no DST) - month boundaries are computed
// against that fixed offset rather than the server's own UTC clock, so a
// payment/due date near midnight lands in the calendar month a person in
// Pretoria would actually call it, not whatever month UTC happens to be in.
export const SAST_OFFSET = '+02:00';

export function monthBounds(year: number, month1to12: number) {
  const start = `${year}-${String(month1to12).padStart(2, '0')}-01T00:00:00${SAST_OFFSET}`;
  const nextMonth = month1to12 === 12 ? 1 : month1to12 + 1;
  const nextYear = month1to12 === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${SAST_OFFSET}`;
  return { start, end };
}

export function inRange(iso: string | null, start: string, end: string) {
  if (!iso) return false;
  return iso >= start && iso < end;
}

export function lineCostBasis(line: any, eventPackageById: Map<string, any>, costLinksByLine: Map<string, any[]>): number | null {
  const eventPackage = line.event_package_id ? eventPackageById.get(line.event_package_id) : null;
  if (eventPackage && eventPackage.computed_cost != null) {
    // Two different semantics depending on how event_package_id got set.
    // The Composer's Pricing Package line source sets it at quote-creation
    // time with quantity meaning "how many of this exact priced row" (its
    // computed_cost already has that row's own unit_multiplier baked in) -
    // that path is untouched: computed_cost * line.quantity.
    // The Cost Linking tab (retroactive) instead lets an admin pick a
    // package by its real name and set a genuine base-unit count via
    // event_package_quantity - the picked row is just a representative
    // price reference there, so its own unit_multiplier has to be divided
    // back out first to get a true per-unit rate before multiplying.
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
  return null; // uncosted
}

export function addMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// A straight sum, not a priority walk - deliberately can't be changed by
// reordering a single month's list, since it's answering "what's our real
// cumulative cash position," not "does this month's priority order work."
export async function computeRunningBalanceThrough(supabase: any, throughMonthKeyInclusive: string) {
  const { data: settings } = await supabase.from('cash_running_balance_settings').select('*').limit(1).single();
  const openingBalance = Number(settings?.opening_balance || 0);
  const openingMonth: string = (settings?.opening_balance_date || new Date().toISOString().split('T')[0]).slice(0, 7);

  // Before the anchor - the opening balance itself is the best available
  // answer (there's no tracked activity prior to it to sum).
  if (throughMonthKeyInclusive < openingMonth) {
    return { balance: openingBalance, openingBalance, openingMonth, breakdown: [] as any[], reachedTarget: false };
  }

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

  const obligationsByMonth = new Map<string, number>();
  for (const inv of invoices || []) {
    if (inv.delivery_gated_on_payment && inv.status !== 'paid') continue;
    const mk: string = inv.delivery_month || String(inv.due_at).slice(0, 7);
    const lines = linesByQuote.get(inv.quote_id) || [];
    let total = 0;
    for (const line of lines) {
      const basis = lineCostBasis(line, eventPackageById, costLinksByLine);
      if (basis !== null) total += basis;
    }
    obligationsByMonth.set(mk, (obligationsByMonth.get(mk) || 0) + total);
  }
  for (const exp of expenses || []) {
    const mk = String(exp.due_date).slice(0, 7);
    obligationsByMonth.set(mk, (obligationsByMonth.get(mk) || 0) + Number(exp.amount));
  }

  const paidByMonth = new Map<string, number>();
  for (const p of payments || []) {
    const mk = String(p.received_at).slice(0, 7);
    paidByMonth.set(mk, (paidByMonth.get(mk) || 0) + Number(p.amount));
  }

  const breakdown: { month: string; paid: number; obligations: number; net: number; balanceAfter: number }[] = [];
  let balance = openingBalance;
  let cursor = openingMonth;
  let guard = 0;
  while (cursor <= throughMonthKeyInclusive && guard < MAX_MONTHS) {
    const paid = paidByMonth.get(cursor) || 0;
    const obligations = obligationsByMonth.get(cursor) || 0;
    const net = paid - obligations;
    balance += net;
    breakdown.push({ month: cursor, paid, obligations, net, balanceAfter: balance });
    cursor = addMonthKey(cursor, 1);
    guard++;
  }

  return { balance, openingBalance, openingMonth, breakdown, reachedTarget: true, truncated: guard >= MAX_MONTHS };
}
