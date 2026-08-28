"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins, CalendarDays, TrendingUp, Wallet, Clock,
  FileText, CreditCard, Receipt, Send, Package, Building2, ShieldCheck,
  ArrowRight, AlertTriangle, RefreshCw, Waves, GripVertical, RotateCcw,
  ChevronLeft, ChevronRight, X, CheckCircle2, Loader2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/lib/supabase";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { ConstraintPill } from "../_components/ConstraintPill";
import { TodayBanner } from "../_components/TodayBanner";
import { LightStatTile } from "../_components/LightStatTile";

function parseLineItems(raw: any): any[] {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch {
    return [];
  }
}

function netLineValue(li: any): number {
  const price = Number(li.price) || 0;
  const qty = Number(li.qty) || 0;
  const disc = Math.max(0, Number(li.disc || 0));
  return price * (1 - disc / 100) * qty;
}

const NAV_TILES = [
  { label: "Quote Composer", desc: "Build a new quote against a lead", icon: FileText, path: "/admin/finance-v2/composer" },
  { label: "Quote Pipeline", desc: "View every quote sent, self-serve or manual", icon: Send, path: "/admin/finance-v2/pipeline" },
  { label: "Invoices", desc: "Every invoice across every client, sorted by due date", icon: CreditCard, path: "/admin/finance-v2/invoices" },
  { label: "Capture Payment", desc: "Manual (non-PayFast) payment entry", icon: Receipt, path: "/admin/finance-v2/capture" },
  { label: "Standing Expenses", desc: "Rent, subscriptions, recurring admin overhead", icon: Wallet, path: "/admin/finance-v2/expenses" },
];

const LEGACY_NAV_TILES = [
  { label: "Payment Capture (Legacy)", desc: "Record a payment against a guardian's old-system invoice", icon: Receipt, path: "/admin/finance/capture" },
  { label: "Client Ledger (AR)", desc: "Old-system accounts receivable", icon: Wallet, path: "/admin/finance/ledger" },
  { label: "Revenue Insights", desc: "Old-system margin analytics", icon: TrendingUp, path: "/admin/finance/insights" },
  { label: "Quote Pipeline (Legacy)", desc: "Old-system quotes, filterable", icon: Send, path: "/admin/finance/pipeline" },
  { label: "Item Catalog", desc: "Priced items & categories", icon: Package, path: "/admin/finance/items" },
  { label: "B2B Consulting", desc: "Corporate client accounts (not yet migrated)", icon: Building2, path: "/admin/consulting" },
];

export default function MoneyAdminPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);
  // Real finance-v2 quotes (composer + self-serve package selection) - the
  // old billing_records table has no idea these exist, which is why this
  // dashboard's "Inventory" tiles were stuck showing only pre-migration
  // pipeline and never moved when a new quote went out. See quotes/list.
  const [v2Quotes, setV2Quotes] = useState<any[]>([]);
  const [consentByLane, setConsentByLane] = useState<Record<string, any>>({});
  const [securityAudit, setSecurityAudit] = useState<{ last_security_audit_at: string | null; last_security_audit_note: string | null } | null>(null);
  // Finance Pipeline: Cash Waterfall spec - due/invoiced/paid tracking and
  // the two-scenario waterfall, computed server-side by cash-waterfall
  // (real invoices + monthly_expenses + pricing-engine cost data, not a
  // second copy of any of that logic here).
  const [waterfallData, setWaterfallData] = useState<any | null>(null);
  // Local, draggable copy of waterfallData.priorityOrder - due date is the
  // recommendation, not a rule (spec §4), so this can be manually
  // reordered and the override is remembered per month. Both scenario
  // panels below are read-only and always reflect this same order, since
  // they're both computed server-side against the one underlying list.
  const [priorityOrder, setPriorityOrder] = useState<any[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  // null = current month (server default). Set once the admin navigates,
  // so standing expenses due in a future/past month (e.g. added ahead of
  // time, like next month's rent) are actually reachable - there was
  // previously no way to view any month but the current one.
  const [waterfallMonth, setWaterfallMonth] = useState<string | null>(null);
  const [invoicePopupId, setInvoicePopupId] = useState<string | null>(null);
  // Cumulative bank position (opening balance + every month's paid minus
  // obligations since) - deliberately separate from the monthly scenarios
  // above, which reset each month on purpose (month-to-month profitability
  // tracking). Reordering priority within a month can't change this figure.
  const [runningBalanceData, setRunningBalanceData] = useState<any | null>(null);
  const [showBalanceSettings, setShowBalanceSettings] = useState(false);

  async function fetchWaterfall(month?: string | null) {
    const targetMonth = month !== undefined ? month : waterfallMonth;
    const [res, balanceRes] = await Promise.all([
      fetch(targetMonth ? `/admin/api/finance-v2/cash-waterfall?month=${targetMonth}` : "/admin/api/finance-v2/cash-waterfall"),
      fetch(targetMonth ? `/admin/api/finance-v2/cash-waterfall/running-balance?month=${targetMonth}` : "/admin/api/finance-v2/cash-waterfall/running-balance"),
    ]);
    const data = await res.json();
    setWaterfallData(data);
    setPriorityOrder(data.priorityOrder || []);
    setRunningBalanceData(balanceRes.ok ? await balanceRes.json() : null);
  }

  function shiftWaterfallMonth(delta: number) {
    const base = waterfallData?.month ? new Date(waterfallData.month + "-01T00:00:00Z") : new Date();
    base.setUTCMonth(base.getUTCMonth() + delta);
    const next = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
    setWaterfallMonth(next);
    fetchWaterfall(next);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: recordsData }, { data: itemsData }, consentRes, settingsRes, v2QuotesRes] = await Promise.all([
          supabase.from("billing_records").select("*"),
          supabase.from("billing_items").select("name, category, aliases"),
          fetch("/admin/api/dashboard-v2/consent-summary"),
          fetch("/admin/api/dashboard-v2/settings"),
          fetch("/admin/api/finance-v2/quotes/list"),
        ]);
        if (recordsData) setRecords(recordsData);
        if (itemsData) setBillingItems(itemsData);
        const { byLane } = await consentRes.json();
        setConsentByLane(byLane || {});
        const { settings } = await settingsRes.json();
        setSecurityAudit(settings || null);
        const { quotes: v2QuotesData } = await v2QuotesRes.json();
        setV2Quotes(v2QuotesData || []);
        await fetchWaterfall();
      } catch (err) {
        console.error("Failed to fetch money-admin data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onDragEndPriority(result: DropResult) {
    if (!result.destination || !waterfallData) return;
    if (result.source.index === result.destination.index) return;
    const reordered = Array.from(priorityOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setPriorityOrder(reordered);
    setSavingOrder(true);
    try {
      await fetch("/admin/api/finance-v2/cash-waterfall/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: waterfallData.month, order: reordered.map((item) => item.id) }),
      });
      await fetchWaterfall();
    } finally {
      setSavingOrder(false);
    }
  }

  async function resetPriorityOrder() {
    if (!waterfallData) return;
    setSavingOrder(true);
    try {
      await fetch(`/admin/api/finance-v2/cash-waterfall/order?month=${waterfallData.month}`, { method: "DELETE" });
      await fetchWaterfall();
    } finally {
      setSavingOrder(false);
    }
  }

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    billingItems.forEach((i) => {
      const category = i.category || "Other";
      if (i.name) map[i.name.toLowerCase().trim()] = category;
      if (Array.isArray(i.aliases)) {
        i.aliases.forEach((alias: string) => {
          if (alias) map[alias.toLowerCase().trim()] = category;
        });
      }
    });
    return map;
  }, [billingItems]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Revenue below is still legacy-only (paid billing_records) - a v2
    // invoice paid via the PayFast webhook lands in the real `invoices`
    // table, which this figure doesn't see yet. Flagged rather than silently
    // wrong: the Inventory section below it is what actually needed fixing
    // for "quotes not showing up," so that's what's wired to v2 here.
    const invoices = records.filter((r) => r.doc_type === "invoice");
    const paidInvoices = invoices.filter((r) => r.status === "paid" || r.status === "settled");

    const revenueSince = (cutoff: Date) =>
      paidInvoices
        .filter((r) => new Date(r.updated_at || r.created_at) >= cutoff)
        .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

    const revenueWeek = revenueSince(startOfWeek);
    const revenueMonth = revenueSince(startOfMonth);
    const revenue90d = revenueSince(last90);

    const revenueByCategory: Record<string, number> = {};
    paidInvoices.forEach((inv) => {
      parseLineItems(inv.line_items).forEach((li: any) => {
        const desc = (li.desc || li.description || "").toLowerCase().trim();
        const category = categoryMap[desc] || "Uncategorized";
        revenueByCategory[category] = (revenueByCategory[category] || 0) + netLineValue(li);
      });
    });
    const topCategories = Object.entries(revenueByCategory).sort((a, b) => b[1] - a[1]);

    // v2's accept flow creates the invoice(s) in the same step a quote
    // becomes "accepted" (see /api/finance-v2/quotes/[id]/accept) - there's
    // no separate "accepted, not yet invoiced" state to track here like the
    // old billing_records pipeline had, so this tile now reads as "accepted
    // quotes, and what's still owed on their invoices" instead.
    const openPipelineQuotes = v2Quotes.filter(
      (q) => q.status === "sent" && (!q.expires_at || new Date(q.expires_at) >= now)
    );
    const openPipelineValue = openPipelineQuotes.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);

    const acceptedQuotes = v2Quotes.filter((q) => q.status === "accepted");
    const acceptedValue = acceptedQuotes.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);
    const avgAcceptedAgeDays =
      acceptedQuotes.length > 0
        ? acceptedQuotes.reduce((sum, q) => sum + (now.getTime() - new Date(q.created_at).getTime()) / 86400000, 0) /
          acceptedQuotes.length
        : 0;

    const v2Invoices = v2Quotes.flatMap((q) => q.invoices || []);
    const outstandingInvoices = v2Invoices.filter((inv) => inv.status !== "paid");
    const arBuckets = { notYetDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    let arTotal = 0;
    outstandingInvoices.forEach((inv) => {
      const outstanding = Math.max(0, (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0));
      arTotal += outstanding;
      const dueDate = inv.due_at
        ? new Date(inv.due_at)
        : new Date(new Date(inv.created_at || now).getTime() + 7 * 24 * 60 * 60 * 1000);
      const daysOverdue = (now.getTime() - dueDate.getTime()) / 86400000;
      if (daysOverdue < 0) arBuckets.notYetDue += outstanding;
      else if (daysOverdue <= 30) arBuckets.d1_30 += outstanding;
      else if (daysOverdue <= 60) arBuckets.d31_60 += outstanding;
      else if (daysOverdue <= 90) arBuckets.d61_90 += outstanding;
      else arBuckets.d90plus += outstanding;
    });

    return {
      revenueWeek, revenueMonth, revenue90d, topCategories,
      openPipelineValue, openPipelineCount: openPipelineQuotes.length,
      acceptedValue, acceptedCount: acceptedQuotes.length, avgAcceptedAgeDays,
      arTotal, arBuckets, outstandingCount: outstandingInvoices.length,
    };
  }, [records, categoryMap, v2Quotes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">Loading…</p>
      </div>
    );
  }

  const rand = (n: number) => `R ${Math.round(n).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <DashboardV2Nav />
        <ConstraintPill />
        <TodayBanner />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Money &amp; Admin</h1>
          <p className="text-stone-500 text-sm mt-1">The Administration spine, made visible — money, consent, security.</p>
        </header>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4">Throughput</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <LightStatTile label="Revenue This Week" value={rand(metrics.revenueWeek)} icon={Coins} color="text-emerald-600" />
            <LightStatTile label="Revenue This Month" value={rand(metrics.revenueMonth)} icon={CalendarDays} color="text-emerald-600" />
            <LightStatTile label="Revenue, Last 90 Days" value={rand(metrics.revenue90d)} icon={TrendingUp} color="text-emerald-600" />
          </div>
          {metrics.topCategories.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">Revenue by Program (Lifetime)</h3>
              <div className="space-y-3">
                {metrics.topCategories.map(([category, amount]) => {
                  const max = metrics.topCategories[0][1] || 1;
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-stone-600">{category}</span>
                        <span className="font-black text-stone-900">{rand(amount)}</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(amount / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 mb-4">Inventory (Not Yet Realized)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <LightStatTile
              label="Open Pipeline (Sent)"
              value={rand(metrics.openPipelineValue)}
              icon={Send}
              color="text-purple-600"
              trend={`${metrics.openPipelineCount} quotes`}
              onClick={() => (window.location.href = "/admin/finance-v2/pipeline")}
            />
            <LightStatTile label="Accepted" value={rand(metrics.acceptedValue)} icon={Clock} color="text-amber-600" trend={`${metrics.acceptedCount} quotes, ${Math.round(metrics.avgAcceptedAgeDays)}d avg age`} onClick={() => (window.location.href = "/admin/finance-v2/pipeline")} />
            <LightStatTile
              label="Outstanding (AR Total)"
              value={rand(metrics.arTotal)}
              icon={CreditCard}
              color="text-rose-600"
              trend={`${metrics.outstandingCount} invoices`}
            />
          </div>
          <div className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">AR Aging</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              {[
                { label: "Not Yet Due", value: metrics.arBuckets.notYetDue, color: "text-stone-600" },
                { label: "1–30 Days", value: metrics.arBuckets.d1_30, color: "text-amber-500" },
                { label: "31–60 Days", value: metrics.arBuckets.d31_60, color: "text-amber-600" },
                { label: "61–90 Days", value: metrics.arBuckets.d61_90, color: "text-rose-500" },
                { label: "90+ Days", value: metrics.arBuckets.d90plus, color: "text-rose-600" },
              ].map((b) => (
                <div key={b.label}>
                  <p className={`text-lg font-black tracking-tight ${b.color}`}>{rand(b.value)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mt-1">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {waterfallData && (
          // A clear "this zone starts here, ends here" frame, distinct from
          // the plain sections above/below it - everything inside is one
          // connected system (order list feeds both scenarios), unlike the
          // independent stat-tile sections elsewhere on this dashboard.
          <section className="relative rounded-[40px] border-2 border-cyan-200 bg-gradient-to-b from-cyan-50/50 to-white p-6 md:p-8 shadow-[0_12px_32px_-8px_rgba(6,182,212,0.18)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600">Cash Waterfall</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => shiftWaterfallMonth(-1)} className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-black text-stone-700 tabular-nums w-20 text-center">{waterfallData.month}</span>
                <button onClick={() => shiftWaterfallMonth(1)} className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {runningBalanceData && (
              <div className="mb-4 bg-stone-900 rounded-[24px] p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Running Cash Balance — as of {runningBalanceData.asOfMonth}</p>
                  <p className={`text-2xl md:text-3xl font-black tracking-tight ${runningBalanceData.runningBalance < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {rand(runningBalanceData.runningBalance)}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Opening {rand(runningBalanceData.openingBalance)} ({runningBalanceData.openingMonth}), carried forward month by month — separate from the monthly scenarios below, which reset each month on purpose.
                  </p>
                </div>
                <button onClick={() => setShowBalanceSettings(true)} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-white shrink-0 self-start md:self-center">
                  Set Opening Balance
                </button>
              </div>
            )}

            {waterfallData.needsConfirmation?.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                <p className="text-[12px] font-bold text-amber-700 flex items-center gap-2">
                  <RefreshCw size={14} /> {waterfallData.needsConfirmation.length} recurring expense{waterfallData.needsConfirmation.length === 1 ? "" : "s"} need{waterfallData.needsConfirmation.length === 1 ? "s" : ""} next month confirmed
                </p>
                <Link href="/admin/finance-v2/expenses" className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 flex items-center gap-1 shrink-0">
                  Review <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {waterfallData.uncostedLines?.length > 0 && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                <p className="text-[12px] font-bold text-orange-700 flex items-center gap-2">
                  <AlertTriangle size={14} /> {waterfallData.uncostedLines.length} line item{waterfallData.uncostedLines.length === 1 ? "" : "s"} on this month's invoices have no known delivery cost
                </p>
                <Link href="/admin/pricing" className="text-[10px] font-black uppercase tracking-widest text-orange-700 hover:text-orange-900 flex items-center gap-1 shrink-0">
                  Link Costs <ArrowRight size={12} />
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">Due Tracker</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">This Month</p>
                    <p className="text-lg font-black text-emerald-600">{rand(waterfallData.dueTracker.thisMonth.paid)} <span className="text-[10px] text-stone-400 font-bold">paid</span></p>
                    <p className="text-lg font-black text-rose-500">{rand(waterfallData.dueTracker.thisMonth.outstanding)} <span className="text-[10px] text-stone-400 font-bold">outstanding</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Next Month</p>
                    <p className="text-lg font-black text-emerald-600">{rand(waterfallData.dueTracker.nextMonth.paid)} <span className="text-[10px] text-stone-400 font-bold">paid</span></p>
                    <p className="text-lg font-black text-rose-500">{rand(waterfallData.dueTracker.nextMonth.outstanding)} <span className="text-[10px] text-stone-400 font-bold">outstanding</span></p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">Invoiced vs. Paid — This Month</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Invoiced</p>
                    <p className="text-xl font-black text-stone-900">{rand(waterfallData.invoicedVsPaid.invoiced)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Paid</p>
                    <p className="text-xl font-black text-stone-900">{rand(waterfallData.invoicedVsPaid.paid)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 mt-3">These can legitimately diverge — an invoice raised this month due later, or a payment landing against an older invoice.</p>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-700">Payment Priority Order</h3>
                {waterfallData.orderIsOverridden && (
                  <button onClick={resetPriorityOrder} disabled={savingOrder} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 disabled:opacity-50">
                    <RotateCcw size={12} /> Reset to Due Date Order
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-400 mb-4">
                Due date is the recommendation, not a rule — drag to reorder. Both scenarios below always follow this same order.
                {waterfallData.orderIsOverridden && <span className="text-cyan-600 font-bold"> Manually ordered.</span>}
              </p>
              {priorityOrder.length === 0 ? (
                <p className="text-[12px] text-stone-400 italic py-4">No standing or delivery-linked expenses due this month yet.</p>
              ) : (
                <DragDropContext onDragEnd={onDragEndPriority}>
                  <Droppable droppableId="priority-order">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                        {priorityOrder.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg ${snapshot.isDragging ? "bg-cyan-50 shadow-md" : "bg-stone-50"}`}
                              >
                                <span {...dragProvided.dragHandleProps} className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing shrink-0">
                                  <GripVertical size={14} />
                                </span>
                                {item.type === "delivery" && item.invoiceId ? (
                                  <button onClick={() => setInvoicePopupId(item.invoiceId)} className="text-stone-600 hover:text-cyan-700 hover:underline truncate flex-1 text-left">
                                    {item.label} <span className="text-stone-400">({new Date(item.due_date).toLocaleDateString("en-ZA")})</span>
                                  </button>
                                ) : (
                                  <span className="text-stone-600 truncate flex-1">{item.label} <span className="text-stone-400">({new Date(item.due_date).toLocaleDateString("en-ZA")})</span></span>
                                )}
                                <span className="font-bold text-stone-900 shrink-0">{rand(item.amount)}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "cashInHand", label: "Cash-in-Hand", desc: `Cash carried in (${rand(waterfallData.enteringBalance || 0)}) plus what's actually been paid this month` },
                { key: "fullyCollected", label: "Fully-Collected", desc: "Cash-in-Hand, plus everyone still due this month paying on time" },
              ].map(({ key, label, desc }) => {
                const scenario = waterfallData.waterfall[key];
                return (
                  <div key={key} className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-black uppercase tracking-widest text-stone-700 flex items-center gap-1.5"><Waves size={13} className="text-cyan-500" /> {label}</h3>
                      {scenario.totalShortfall > 0 && <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Shortfall {rand(scenario.totalShortfall)}</span>}
                    </div>
                    <p className="text-[10px] text-stone-400 mb-3">{desc}</p>
                    {scenario.items.length === 0 ? (
                      <p className="text-[12px] text-stone-400 italic py-4">No standing or delivery-linked expenses due this month yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {scenario.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-[12px] px-3 py-2 rounded-lg bg-stone-50">
                            {item.type === "delivery" && item.invoiceId ? (
                              <button onClick={() => setInvoicePopupId(item.invoiceId)} className="text-stone-600 hover:text-cyan-700 hover:underline truncate text-left">
                                {item.label} <span className="text-stone-400">({new Date(item.due_date).toLocaleDateString("en-ZA")})</span>
                              </button>
                            ) : (
                              <span className="text-stone-600 truncate">{item.label} <span className="text-stone-400">({new Date(item.due_date).toLocaleDateString("en-ZA")})</span></span>
                            )}
                            <span className={`font-bold shrink-0 ml-2 ${item.status === "covered" ? "text-emerald-600" : item.status === "partial" ? "text-amber-600" : "text-rose-600"}`}>
                              {rand(item.amount)} · {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {invoicePopupId && (
          <InvoicePopup
            invoiceId={invoicePopupId}
            onClose={() => setInvoicePopupId(null)}
            onChanged={() => fetchWaterfall()}
          />
        )}

        {showBalanceSettings && runningBalanceData && (
          <BalanceSettingsPopup
            initialAmount={runningBalanceData.openingBalance}
            initialDate={`${runningBalanceData.openingMonth}-01`}
            onClose={() => setShowBalanceSettings(false)}
            onSaved={() => {
              setShowBalanceSettings(false);
              fetchWaterfall();
            }}
          />
        )}

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4">POPIA Consent State</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                  <th className="pb-3">Lane</th>
                  <th className="pb-3 text-right">Total Leads</th>
                  <th className="pb-3 text-right">consent_marketing</th>
                  <th className="pb-3 text-right">marketing_consent_at</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(consentByLane).map(([lane, stats]: [string, any]) => (
                  <tr key={lane} className="border-b border-stone-50 last:border-0">
                    <td className="py-3 font-bold text-stone-800">{lane}</td>
                    <td className="py-3 text-right text-stone-600">{stats.total}</td>
                    <td className="py-3 text-right text-stone-600">{stats.consentMarketing}</td>
                    <td className="py-3 text-right text-stone-600">{stats.marketingConsentAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-stone-400 mt-4">
              Two separate consent-write paths exist on `leads` (irene_* routes use consent_marketing; the events-page
              register-interest flow uses marketing_consent_at) — shown separately rather than merged, since they aren't
              reconciled yet.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mb-4">Security Check Log</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm flex items-center gap-4">
            <ShieldCheck className="text-stone-400" size={24} />
            <p className="text-sm text-stone-600">
              Last RLS/anon-key audit: <span className="font-bold text-stone-900">{securityAudit?.last_security_audit_at ? new Date(securityAudit.last_security_audit_at).toLocaleDateString("en-ZA") : "Not recorded yet"}</span>
              {securityAudit?.last_security_audit_note && <span className="text-stone-500"> — {securityAudit.last_security_audit_note}</span>}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4">Finance Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {NAV_TILES.map((tile) => (
              <Link key={tile.path} href={tile.path} className="p-5 bg-white border border-stone-200 hover:border-blue-300 rounded-[20px] transition-all flex flex-col gap-3 shadow-sm">
                <tile.icon size={22} className="text-stone-400" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-stone-800">{tile.label}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">{tile.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">Legacy (Pre-Migration)</h2>
          <p className="text-[10px] text-stone-400 mb-4">Old profiles/billing_records system — still serves documents created before this migration. Nothing new should be created here.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-70">
            {LEGACY_NAV_TILES.map((tile) => (
              <Link key={tile.path} href={tile.path} className="p-5 bg-white border border-stone-200 rounded-[20px] transition-all flex flex-col gap-3 shadow-sm">
                <tile.icon size={22} className="text-stone-400" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-stone-600">{tile.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{tile.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// Read-only view of what an invoice actually is - "INV-8" on its own means
// nothing, and the admin edit form is the wrong tool for a quick "what was
// this" glance. Reuses the same public read the invoice-v2 page already
// uses (invoices/quote_line_items/leads have no anon RLS either way, so
// that endpoint already has to run server-side and return everything
// needed). Mark as Paid is a reconciliation action, not payment capture -
// see the mark-paid route for why it deliberately doesn't touch
// invoice_payments.
function InvoicePopup({ invoiceId, onClose, onChanged }: { invoiceId: string; onClose: () => void; onChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Delivery timing - decoupled from due_at, which stays the payment
  // deadline. deliveryMonthInput "" means "use due date's month" (default).
  const [deliveryMonthInput, setDeliveryMonthInput] = useState("");
  const [deliveryGated, setDeliveryGated] = useState(false);
  const [savingTiming, setSavingTiming] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/finance-v2/invoices/${invoiceId}`);
      const json = await res.json();
      setData(res.ok ? json : null);
      if (res.ok) {
        setDeliveryMonthInput(json.invoice.delivery_month || "");
        setDeliveryGated(!!json.invoice.delivery_gated_on_payment);
      }
      setLoading(false);
    })();
  }, [invoiceId]);

  async function markPaid() {
    setMarking(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/invoices/${invoiceId}/mark-paid`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData((prev: any) => (prev ? { ...prev, invoice: json.invoice } : prev));
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarking(false);
    }
  }

  async function saveDeliveryTiming() {
    setSavingTiming(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/invoices/${invoiceId}/delivery-timing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_month: deliveryMonthInput || null, delivery_gated_on_payment: deliveryGated }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData((prev: any) => (prev ? { ...prev, invoice: json.invoice } : prev));
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTiming(false);
    }
  }

  const rand = (n: number) => `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="py-24 flex items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></div>
        ) : !data ? (
          <div className="py-24 text-center text-stone-400 text-sm">Invoice not found.</div>
        ) : (
          <div className="p-7 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Invoice</p>
                <h3 className="text-xl font-black text-stone-900">INV-{data.invoice.invoice_number}</h3>
              </div>
              <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-stone-900">{data.lead?.name || "Unknown lead"}</p>
              <p className="text-xs text-stone-500">{data.lead?.phone || data.lead?.email || ""}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">What this was for</p>
              {data.lineItems.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No line items on record — likely an instalment slice of a larger quote.</p>
              ) : (
                data.lineItems.map((li: any) => (
                  <div key={li.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-stone-50">
                    <span className="text-stone-700">{li.description} {li.quantity > 1 && <span className="text-stone-400">× {li.quantity}</span>}</span>
                    <span className="font-bold text-stone-900">{rand(li.line_total)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Status</p>
                <p className={`text-sm font-black ${data.invoice.status === "paid" ? "text-emerald-600" : "text-rose-500"}`}>{data.invoice.status}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Amount</p>
                <p className="text-lg font-black text-stone-900">{rand(data.invoice.amount)}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Delivery Timing</p>
              <p className="text-[11px] text-stone-500">
                When the cost of actually delivering this is incurred — separate from the due date above, which is just when the client needs to pay.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={deliveryMonthInput}
                  onChange={(e) => setDeliveryMonthInput(e.target.value)}
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-400"
                />
                {deliveryMonthInput && (
                  <button onClick={() => setDeliveryMonthInput("")} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 shrink-0">
                    Use due date
                  </button>
                )}
              </div>
              <label className="flex items-start gap-2 text-[11px] text-stone-600 cursor-pointer">
                <input type="checkbox" checked={deliveryGated} onChange={(e) => setDeliveryGated(e.target.checked)} className="w-3.5 h-3.5 mt-0.5 accent-cyan-600" />
                Delivery hasn't started — exclude this from every month's waterfall until the invoice is actually paid (the month above is then just the tentative plan)
              </label>
              <button
                onClick={saveDeliveryTiming}
                disabled={savingTiming}
                className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingTiming ? <Loader2 size={13} className="animate-spin" /> : null} Save Delivery Timing
              </button>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            {data.invoice.status === "paid" ? (
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <CheckCircle2 size={14} /> Already paid — not part of this cycle's cash to collect.
              </p>
            ) : (
              <button
                onClick={markPaid}
                disabled={marking}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {marking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Mark as Paid
              </button>
            )}
            <p className="text-[10px] text-stone-400 text-center">
              For settling an invoice that was already paid through another channel — this won't show up as new cash received this month. For a real new payment, use Capture Payment instead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceSettingsPopup({ initialAmount, initialDate, onClose, onSaved }: { initialAmount: number; initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/finance-v2/cash-waterfall/running-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opening_balance: Number(amount) || 0, opening_balance_date: date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-7 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-stone-900">Opening Balance</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-stone-500">
          The real bank balance as of a specific date — the anchor the running balance carries forward from. Months before this date aren't tracked and don't affect it.
        </p>
        <div>
          <label className="block text-[11px] font-bold text-stone-600 mb-1">Balance (R)</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-stone-600 mb-1">As of Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-cyan-400" />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
