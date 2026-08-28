"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Loader2, ExternalLink, Receipt, Coins,
  CheckCircle2, AlertCircle, Clock, Wallet,
} from "lucide-react";

type EffectiveStatus = "pending" | "partially_paid" | "paid" | "overdue";

function effectiveStatus(inv: any): EffectiveStatus {
  if (inv.status === "paid") return "paid";
  if (inv.due_at && new Date(inv.due_at) < new Date()) return "overdue";
  return inv.status === "partially_paid" ? "partially_paid" : "pending";
}

const STATUS_STYLE: Record<EffectiveStatus, { label: string; className: string; icon: any }> = {
  pending: { label: "Pending", className: "bg-blue-50 text-blue-600 border-blue-100", icon: Clock },
  partially_paid: { label: "Partially Paid", className: "bg-amber-50 text-amber-600 border-amber-100", icon: Coins },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: CheckCircle2 },
  overdue: { label: "Overdue", className: "bg-rose-50 text-rose-600 border-rose-100", icon: AlertCircle },
};

const TABS: { key: "all" | EffectiveStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "pending", label: "Pending" },
  { key: "partially_paid", label: "Partially Paid" },
  { key: "paid", label: "Paid" },
];

export default function InvoicesV2Page() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | EffectiveStatus>("all");
  const [search, setSearch] = useState("");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/finance-v2/invoices");
      const { invoices: data } = await res.json();
      setInvoices(data || []);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const status = effectiveStatus(inv);
      if (tab !== "all" && status !== tab) return false;
      if (!q) return true;
      const haystack = [
        `inv-${inv.invoice_number}`,
        inv.lead?.name,
        inv.lead?.company_name,
        inv.lead?.phone,
        inv.lead?.email,
        inv.quote ? `qt-${inv.quote.quote_number}` : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, tab, search]);

  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const outstanding = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
    const overdue = invoices.filter((inv) => effectiveStatus(inv) === "overdue");
    const paidThisMonth = invoices.filter((inv) => inv.paid_at && new Date(inv.paid_at) >= monthStart);
    return {
      outstanding,
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((s, inv) => s + inv.outstanding, 0),
      paidThisMonthValue: paidThisMonth.reduce((s, inv) => s + Number(inv.amount_paid || 0), 0),
      paidThisMonthCount: paidThisMonth.length,
    };
  }, [invoices]);

  const rand = (n: number) => `R ${Math.round(n).toLocaleString()}`;

  async function markPaid(inv: any) {
    if (!window.confirm(`Mark INV-${inv.invoice_number} as already paid? This is for reconciliation only (money that landed outside the system) - it will not record a payment in Cash Waterfall.`)) return;
    setMarkingPaidId(inv.id);
    try {
      const res = await fetch(`/admin/api/finance-v2/invoices/${inv.id}/mark-paid`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark paid");
      await fetchInvoices();
      setToast(`INV-${inv.invoice_number} marked paid.`);
    } catch (err: any) {
      setToast(`Failed: ${err.message}`);
    } finally {
      setMarkingPaidId(null);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link href="/admin/dashboard-v2/money-admin" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-600 flex items-center gap-2 transition-colors mb-4">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
            Invoices <span className="text-cyan-600 text-xl align-top">v2</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Every v2 invoice, across every client — the real invoices table, independent of drilling into a specific quote.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outstanding</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.outstanding)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Across all unpaid invoices</p>
            </div>
            <Wallet className="text-blue-500" size={20} />
          </div>
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overdue</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.overdueValue)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{metrics.overdueCount} invoice{metrics.overdueCount === 1 ? "" : "s"} past due</p>
            </div>
            <AlertCircle className="text-rose-500" size={20} />
          </div>
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paid This Month</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.paidThisMonthValue)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{metrics.paidThisMonthCount} invoice{metrics.paidThisMonthCount === 1 ? "" : "s"}</p>
            </div>
            <CheckCircle2 className="text-emerald-500" size={20} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t.key ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, company, invoice #..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">No invoices match this view.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inv) => {
              const status = effectiveStatus(inv);
              const style = STATUS_STYLE[status];
              const StatusIcon = style.icon;
              const clientName = inv.lead?.company_name || inv.lead?.name || "Unknown";
              return (
                <div key={inv.id} className="bg-white border border-slate-200 rounded-[20px] p-5 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">INV-{inv.invoice_number}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.className}`}>
                        <StatusIcon size={11} /> {style.label}
                      </span>
                      {inv.quote && (
                        <Link href={`/quote-v2/${inv.quote.id}`} target="_blank" className="text-[9px] font-mono text-slate-400 hover:text-slate-600">
                          from QT-{inv.quote.quote_number}
                        </Link>
                      )}
                    </div>
                    <p className="font-bold text-sm mt-2 truncate text-slate-800">{clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{inv.lead?.phone || inv.lead?.email || "No contact"}</p>
                  </div>

                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="text-right">
                      <p className="font-black text-lg tracking-tight">{rand(Number(inv.amount) || 0)}</p>
                      {inv.outstanding > 0 ? (
                        <p className="text-[9px] text-amber-600 uppercase tracking-widest mt-0.5">{rand(inv.outstanding)} outstanding</p>
                      ) : (
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Due {inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-ZA") : "—"}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/invoice-v2/${inv.id}`}
                        target="_blank"
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all"
                        title="View live invoice"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      {inv.outstanding > 0 && (
                        <>
                          <Link
                            href={`/admin/finance-v2/capture?lead_id=${inv.lead_id}&invoice_id=${inv.id}`}
                            className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-all"
                            title="Capture Payment for this invoice"
                          >
                            <Receipt size={14} />
                          </Link>
                          <button
                            onClick={() => markPaid(inv)}
                            disabled={markingPaidId === inv.id}
                            className="px-2.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all text-[9px] font-black uppercase disabled:opacity-40"
                            title="Reconciliation only - money that landed outside the system"
                          >
                            {markingPaidId === inv.id ? <Loader2 size={14} className="animate-spin" /> : "Mark Paid"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
