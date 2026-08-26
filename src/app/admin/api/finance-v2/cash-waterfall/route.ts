import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// RAD Academy runs on SAST (UTC+2, no DST) - month boundaries are computed
// against that fixed offset rather than the server's own UTC clock, so a
// payment/due date near midnight lands in the calendar month a person in
// Pretoria would actually call it, not whatever month UTC happens to be in.
const SAST_OFFSET = '+02:00';

function monthBounds(year: number, month1to12: number) {
  const start = `${year}-${String(month1to12).padStart(2, '0')}-01T00:00:00${SAST_OFFSET}`;
  const nextMonth = month1to12 === 12 ? 1 : month1to12 + 1;
  const nextYear = month1to12 === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${SAST_OFFSET}`;
  return { start, end };
}

function inRange(iso: string | null, start: string, end: string) {
  if (!iso) return false;
  return iso >= start && iso < end;
}

function lineCostBasis(line: any, eventPackageById: Map<string, any>, costLinksByLine: Map<string, any[]>): number | null {
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

  const supabase = supabaseAdmin();

  const [{ data: invoices }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('invoice_payments').select('*'),
    supabase.from('monthly_expenses').select('*').eq('active', true),
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
    .reduce((s, p) => s + Number(p.amount), 0);

  // --- §2.3: delivery-linked rollup, one expense entry per invoice due this month ---
  const quoteIdsDue = [...new Set(dueThisMonth.map((i) => i.quote_id).filter(Boolean))];
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
  const quoteIdsForLabels = [...new Set(dueThisMonth.map((i) => i.quote_id).filter(Boolean))];
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
  const deliveryLinkedExpenses = dueThisMonth
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
      return { id: `inv-${inv.id}`, label: `${label} (INV-${inv.invoice_number})`, due_date: inv.due_at, amount: total, type: 'delivery' as const };
    })
    .filter((e) => e.amount > 0);

  // --- §2.2: standing expenses due this month ---
  const standingExpenses = (expenses || [])
    .filter((e) => inRange(e.due_date + 'T00:00:00' + SAST_OFFSET, thisMonth.start, thisMonth.end))
    .map((e) => ({ id: `exp-${e.id}`, label: e.name, due_date: e.due_date, amount: Number(e.amount), type: 'standing' as const }));

  // --- §4: waterfall, both scenarios ---
  const orderedList = [...standingExpenses, ...deliveryLinkedExpenses].sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

  const dueUnpaidThisMonth = dueThisMonth.filter((i) => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0);

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

  const cashInHand = runScenario(paidThisMonth);
  const fullyCollected = runScenario(paidThisMonth + dueUnpaidThisMonth);

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
    month: `${year}-${String(month).padStart(2, '0')}`,
    dueTracker,
    invoicedVsPaid: { invoiced: invoicedThisMonth, paid: paidThisMonth },
    waterfall: { cashInHand, fullyCollected },
    uncostedLines,
    needsConfirmation,
  });
}
