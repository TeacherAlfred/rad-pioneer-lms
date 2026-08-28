import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { monthBounds, inRange, lineCostBasis, addMonthKey, computeRunningBalanceThrough, SAST_OFFSET } from '@/lib/cashWaterfall';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month'); // "YYYY-MM"
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split('-').map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];

  const thisMonth = monthBounds(year, month);
  const nextMonthNum = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = monthBounds(nextMonthYear, nextMonthNum);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const supabase = supabaseAdmin();

  const [{ data: invoices }, { data: payments }, { data: expenses }, { data: balanceForwardPayments }] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('invoice_payments').select('*'),
    supabase.from('monthly_expenses').select('*').eq('active', true),
    supabase.from('lead_balance_forward_payments').select('*'),
  ]);

  // --- §3: Due tracker ---
  const dueThisMonth = (invoices || []).filter((inv) => inRange(inv.due_at, thisMonth.start, thisMonth.end));
  const dueNextMonth = (invoices || []).filter((inv) => inRange(inv.due_at, nextMonth.start, nextMonth.end));
  const sumAmt = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount), 0);
  const dueTracker = {
    thisMonth: {
      paid: sumAmt(dueThisMonth.filter((i) => i.status === 'paid')),
      outstanding: sumAmt(dueThisMonth.filter((i) => i.status !== 'paid')),
    },
    nextMonth: {
      paid: sumAmt(dueNextMonth.filter((i) => i.status === 'paid')),
      outstanding: sumAmt(dueNextMonth.filter((i) => i.status !== 'paid')),
    },
  };

  // --- §3: Invoiced vs. Paid ---
  const invoicedThisMonth = sumAmt((invoices || []).filter((inv) => inRange(inv.created_at, thisMonth.start, thisMonth.end)));
  const paidThisMonth = (payments || [])
    .filter((p) => inRange(p.received_at, thisMonth.start, thisMonth.end))
    .reduce((s, p) => s + Number(p.amount), 0)
    // Legacy brought-forward debt collected this month is real cash too -
    // see computeRunningBalanceThrough for why this has to match.
    + (balanceForwardPayments || [])
      .filter((p) => inRange(p.received_at + 'T00:00:00' + SAST_OFFSET, thisMonth.start, thisMonth.end))
      .reduce((s, p) => s + Number(p.amount), 0);

  // --- §2.3: delivery-linked rollup, one expense entry per invoice whose
  // delivery falls in this month. NOT the same set as dueThisMonth: a
  // workshop instalment can be due in one month for a workshop actually
  // running in another, and some services don't start (so don't incur any
  // cost obligation to plan for) until the invoice is actually paid, with
  // the start month itself only a tentative plan until then. due_at still
  // drives the Due tracker above - that's a separate question (when the
  // client needs to pay) from when the cost is actually incurred.
  const deliveryInvoicesThisMonth = (invoices || []).filter((inv) => {
    if (inv.delivery_gated_on_payment && inv.status !== 'paid') return false;
    if (inv.delivery_month) return inv.delivery_month === monthKey;
    return inRange(inv.due_at, thisMonth.start, thisMonth.end);
  });

  const quoteIdsDue = [...new Set(deliveryInvoicesThisMonth.map((i) => i.quote_id).filter(Boolean))];
  const { data: linesForDueQuotes } = quoteIdsDue.length
    ? await supabase.from('quote_line_items').select('*').in('quote_id', quoteIdsDue)
    : { data: [] as any[] };

  const eventPackageIds = [...new Set((linesForDueQuotes || []).map((l: any) => l.event_package_id).filter(Boolean))];
  const lineIds = (linesForDueQuotes || []).map((l: any) => l.id);
  const [{ data: eventPackages }, { data: costLinks }] = await Promise.all([
    eventPackageIds.length ? supabase.from('event_packages').select('id, computed_cost, unit_multiplier').in('id', eventPackageIds) : Promise.resolve({ data: [] as any[] }),
    lineIds.length
      ? supabase.from('quote_line_item_costs').select('*, inventory_item:inventory_items(id, name, unit_cost)').in('quote_line_item_id', lineIds)
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
  (linesForDueQuotes || []).forEach((line: any) => {
    const arr = linesByQuote.get(line.quote_id) || [];
    arr.push(line);
    linesByQuote.set(line.quote_id, arr);
  });

  // "INV-8 delivery cost" means nothing on its own - this is the real cost
  // of delivering a specific service to a specific family, so the label
  // needs to say what and for whom. INV-8 stays, just demoted to a
  // parenthetical reference instead of being the whole label.
  const quoteIdsForLabels = [...new Set(deliveryInvoicesThisMonth.map((i) => i.quote_id).filter(Boolean))];
  const { data: quotesForLabels } = quoteIdsForLabels.length
    ? await supabase.from('quotes').select('id, lead_id, program_id').in('id', quoteIdsForLabels)
    : { data: [] as any[] };
  const leadIdsForLabels = [...new Set((quotesForLabels || []).map((q: any) => q.lead_id).filter(Boolean))];
  const programIdsForLabels = [...new Set((quotesForLabels || []).map((q: any) => q.program_id).filter(Boolean))];
  const [{ data: leadsForLabels }, { data: programsForLabels }] = await Promise.all([
    leadIdsForLabels.length ? supabase.from('leads').select('id, name').in('id', leadIdsForLabels) : Promise.resolve({ data: [] as any[] }),
    programIdsForLabels.length ? supabase.from('programs').select('id, name').in('id', programIdsForLabels) : Promise.resolve({ data: [] as any[] }),
  ]);
  const leadNameById = new Map((leadsForLabels || []).map((l: any) => [l.id, l.name]));
  const programNameById = new Map((programsForLabels || []).map((p: any) => [p.id, p.name]));
  const quoteById = new Map((quotesForLabels || []).map((q: any) => [q.id, q]));

  const uncostedLines: any[] = [];
  const deliveryLinkedExpenses = deliveryInvoicesThisMonth
    .map((inv) => {
      const lines = linesByQuote.get(inv.quote_id) || [];
      let total = 0;
      for (const line of lines) {
        const basis = lineCostBasis(line, eventPackageById, costLinksByLine);
        if (basis === null) {
          uncostedLines.push({ id: line.id, description: line.description, quote_id: line.quote_id, invoice_number: inv.invoice_number });
        } else {
          total += basis;
        }
      }
      const quote = quoteById.get(inv.quote_id);
      const leadName = quote ? leadNameById.get(quote.lead_id) : null;
      const programName = quote ? programNameById.get(quote.program_id) : null;
      const label = [leadName, programName].filter(Boolean).join(' — ') || 'Delivery cost (lead/programme unavailable)';
      return {
        id: `inv-${inv.id}`,
        label: `${label} (INV-${inv.invoice_number})`,
        due_date: inv.due_at,
        amount: total,
        type: 'delivery' as const,
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceStatus: inv.status,
        deliveryMonth: inv.delivery_month,
        deliveryGatedOnPayment: inv.delivery_gated_on_payment,
      };
    })
    .filter((e) => e.amount > 0);

  // --- §2.2: standing expenses due this month ---
  const standingExpenses = (expenses || [])
    .filter((e) => inRange(e.due_date + 'T00:00:00' + SAST_OFFSET, thisMonth.start, thisMonth.end))
    .map((e) => ({ id: `exp-${e.id}`, label: e.name, due_date: e.due_date, amount: Number(e.amount), type: 'standing' as const }));

  // --- §4: waterfall, both scenarios ---
  const dateOrderedList = [...standingExpenses, ...deliveryLinkedExpenses].sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

  // Due-date order is the recommendation, not a rule - an admin can
  // override it (e.g. pay a specific supplier ahead of an earlier-due
  // item for relationship reasons the date alone doesn't capture). The
  // override is a full saved sequence for this month, not per-item ranks -
  // anything in the current list that wasn't part of a saved sequence
  // (e.g. a new invoice that became due after the last reorder) is
  // appended at the end in date order rather than silently dropped.
  const { data: overrides } = await supabase
    .from('cash_waterfall_priority_overrides')
    .select('item_key, sort_index')
    .eq('month', monthKey)
    .order('sort_index', { ascending: true });
  let orderedList = dateOrderedList;
  let orderIsOverridden = false;
  if (overrides && overrides.length > 0) {
    orderIsOverridden = true;
    const rankByKey = new Map(overrides.map((o) => [o.item_key, o.sort_index]));
    const ranked = dateOrderedList.filter((item) => rankByKey.has(item.id)).sort((a, b) => rankByKey.get(a.id)! - rankByKey.get(b.id)!);
    const unranked = dateOrderedList.filter((item) => !rankByKey.has(item.id));
    orderedList = [...ranked, ...unranked];
  }

  const dueUnpaidThisMonth = dueThisMonth.filter((i) => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0);

  // Cash-in-Hand's available cash can't just be this month's fresh receipts
  // reset to R0 - a family's payment landing in an earlier month (say,
  // INV-8's own payment, received in July) is real cash still sitting in
  // the bank in August, and this month's shortfall check needs to see it.
  // Entering balance = the running balance as of the END of the PREVIOUS
  // month (a straight sum, not a priority walk - see computeRunningBalanceThrough).
  const enteringBalanceResult = await computeRunningBalanceThrough(supabase, addMonthKey(monthKey, -1));
  const enteringBalance = enteringBalanceResult.balance;

  function runScenario(availableCash: number) {
    let remaining = availableCash;
    let totalShortfall = 0;
    const items = orderedList.map((expense) => {
      if (remaining >= expense.amount) {
        remaining -= expense.amount;
        return { ...expense, status: 'covered' as const };
      }
      if (remaining > 0) {
        const shortfallPortion = expense.amount - remaining;
        totalShortfall += shortfallPortion;
        remaining = 0;
        return { ...expense, status: 'partial' as const, covered: expense.amount - shortfallPortion, shortfall: shortfallPortion };
      }
      totalShortfall += expense.amount;
      return { ...expense, status: 'shortfall' as const };
    });
    return { items, totalShortfall };
  }

  const cashInHand = runScenario(enteringBalance + paidThisMonth);
  const fullyCollected = runScenario(enteringBalance + paidThisMonth + dueUnpaidThisMonth);

  // --- recurring-expense confirmation prompts (never auto-created) ---
  const nowDateStr = now.toISOString().split('T')[0];
  const needsConfirmation = (expenses || []).filter((e) => {
    if (!e.recurring || e.due_date >= nowDateStr) return false;
    const nextDue = (() => {
      const d = new Date(e.due_date + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d.toISOString().split('T')[0];
    })();
    return !(expenses || []).some((other) => other.name === e.name && other.due_date === nextDue);
  });

  return NextResponse.json({
    month: monthKey,
    dueTracker,
    invoicedVsPaid: { invoiced: invoicedThisMonth, paid: paidThisMonth },
    // Order-only view (no per-scenario covered/shortfall) - the single
    // source of truth for "what order" that the drag-to-reorder UI edits.
    // Both scenarios below are guaranteed to share this exact order, since
    // they're both run against the same orderedList.
    priorityOrder: orderedList.map(({ id, label, due_date, amount, type, invoiceId, invoiceNumber, invoiceStatus }: any) => ({
      id, label, due_date, amount, type, invoiceId, invoiceNumber, invoiceStatus,
    })),
    orderIsOverridden,
    enteringBalance,
    waterfall: { cashInHand, fullyCollected },
    uncostedLines,
    needsConfirmation,
  });
}
