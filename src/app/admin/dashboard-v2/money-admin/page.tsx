"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins, CalendarDays, TrendingUp, Wallet, Clock,
  FileText, CreditCard, Receipt, Send, Package, Building2, ShieldCheck,
} from "lucide-react";
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
  { label: "Capture Payment", desc: "Manual (non-PayFast) payment entry", icon: Receipt, path: "/admin/finance-v2/capture" },
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
      } catch (err) {
        console.error("Failed to fetch money-admin data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
