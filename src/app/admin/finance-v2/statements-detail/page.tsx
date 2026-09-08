"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Search, Loader2, X, ExternalLink, Clock, Coins, CheckCircle2, Ban,
} from "lucide-react";

type LeadHit = { id: string; name: string | null; phone: string | null; email: string | null; company_name: string | null };
type Payment = { id: string; amount: number; received_at: string; method: string | null; created_by: string | null };
type LineItem = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; line_total: number };
type Invoice = {
  id: string; invoice_number: number; sequence_number: number; status: string;
  amount: number; amount_paid: number; outstanding: number; due_at: string | null; created_at: string;
  credited_at: string | null; credit_reason: string | null;
  payments: Payment[]; lineItems: LineItem[];
};
type BalanceForward = { amount: number; as_of_date: string; description: string | null; legacy_reference: string | null; payments: Payment[] };
type LedgerData = {
  lead: LeadHit;
  invoices: Invoice[];
  balanceForward: BalanceForward | null;
};

const STATUS_STYLE: Record<string, { label: string; className: string; icon: any }> = {
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: CheckCircle2 },
  partially_paid: { label: "Partially Paid", className: "bg-amber-50 text-amber-600 border-amber-100", icon: Coins },
  pending: { label: "Pending", className: "bg-blue-50 text-blue-600 border-blue-100", icon: Clock },
  cancelled: { label: "Credited", className: "bg-slate-100 text-slate-500 border-slate-200", icon: Ban },
};
function statusStyle(status: string) {
  return STATUS_STYLE[status] || { label: status, className: "bg-slate-50 text-slate-500 border-slate-100", icon: Clock };
}

const rand = (n: number) => `R ${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-ZA");

type Period = "quarter" | "year" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

function periodRange(period: Period): { start: Date; end: Date } | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 1) };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
}
function inRange(dateStr: string, range: { start: Date; end: Date } | null) {
  if (!range) return true;
  const d = new Date(dateStr);
  return d >= range.start && d < range.end;
}

// Every invoice whose issue date falls in the selected period is shown in
// full - all its line items and all payments against it, regardless of when
// those payments landed - rather than partially rendering an invoice. A
// payment against an out-of-period invoice therefore won't appear; that's
// the deliberate tradeoff for "this period's billing, itemized" over a
// strict cash-received-this-period view.
type StatementRow = { key: string; date: string; ref: string; desc: string; meta: string | null; debit: number | null; credit: number | null };

function buildRows(data: LedgerData, range: { start: Date; end: Date } | null): StatementRow[] {
  const rows: StatementRow[] = [];

  if (data.balanceForward && inRange(data.balanceForward.as_of_date, range)) {
    rows.push({
      key: "bf", date: data.balanceForward.as_of_date,
      ref: data.balanceForward.legacy_reference || "Balance B/F",
      desc: data.balanceForward.description || "Balance brought forward",
      meta: null, debit: Number(data.balanceForward.amount), credit: null,
    });
    data.balanceForward.payments.forEach((p) => {
      rows.push({ key: `bfp-${p.id}`, date: p.received_at, ref: "Payment", desc: p.created_by || "Payment received", meta: null, debit: null, credit: Number(p.amount) });
    });
  }

  data.invoices.forEach((inv) => {
    if (!inRange(inv.created_at, range)) return;
    // Credited invoices are void - one informational, zero-amount row (not
    // struck-through line items) so the audit trail still shows it existed,
    // without letting its original amount pollute the period's debit total.
    if (inv.status === "cancelled") {
      rows.push({
        key: `inv-${inv.id}`, date: inv.credited_at || inv.created_at, ref: `INV-${inv.invoice_number}`,
        desc: `Credited${inv.credit_reason ? ` — ${inv.credit_reason}` : ""}`,
        meta: `Originally ${rand(inv.amount)}, written off`, debit: null, credit: null,
      });
      return;
    }
    if (inv.lineItems.length > 0) {
      inv.lineItems.forEach((li) => {
        rows.push({
          key: `li-${li.id}`, date: inv.created_at, ref: `INV-${inv.invoice_number}`,
          desc: li.description,
          meta: `${li.quantity} × ${rand(li.unit_price)}${li.discount_pct ? ` − ${li.discount_pct}% disc.` : ""}`,
          debit: Number(li.line_total), credit: null,
        });
      });
    } else {
      rows.push({
        key: `inv-${inv.id}`, date: inv.created_at, ref: `INV-${inv.invoice_number}`,
        desc: `Instalment #${inv.sequence_number}`, meta: null, debit: Number(inv.amount), credit: null,
      });
    }
    inv.payments.forEach((p) => {
      rows.push({
        key: `pay-${p.id}`, date: p.received_at, ref: `INV-${inv.invoice_number}`,
        desc: `Payment${p.method ? ` (${p.method})` : ""}`,
        meta: p.created_by || null, debit: null, credit: Number(p.amount),
      });
    });
  });

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return rows;
}

function StatementsDetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillLeadId = searchParams.get("lead_id");

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<LeadHit[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadHit | null>(null);
  const [data, setData] = useState<LedgerData | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [period, setPeriod] = useState<Period>("year");

  useEffect(() => {
    if (search.trim().length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(search)}`);
        const { leads } = await res.json();
        setSuggestions(leads || []);
      }, 250);
      return () => clearTimeout(t);
    }
    setSuggestions([]);
  }, [search]);

  useEffect(() => {
    if (!prefillLeadId) return;
    (async () => {
      const res = await fetch(`/admin/api/finance-v2/leads?id=${prefillLeadId}`);
      const { leads } = await res.json();
      if (leads?.[0]) selectLead(leads[0], false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillLeadId]);

  async function selectLead(lead: LeadHit, updateUrl = true) {
    setSelectedLead(lead);
    setSearch("");
    setSuggestions([]);
    setData(null);
    if (updateUrl) router.replace(`/admin/finance-v2/statements-detail?lead_id=${lead.id}`);
    setLoadingLedger(true);
    try {
      const res = await fetch(`/admin/api/finance-v2/leads/${lead.id}/ledger`);
      const json = await res.json();
      setData(res.ok ? json : null);
    } finally {
      setLoadingLedger(false);
    }
  }

  function clearLead() {
    setSelectedLead(null);
    setData(null);
    router.replace("/admin/finance-v2/statements-detail");
  }

  const range = useMemo(() => periodRange(period), [period]);
  const rows = useMemo(() => (data ? buildRows(data, range) : []), [data, range]);
  const invoicesInPeriod = useMemo(() => (data ? data.invoices.filter((inv) => inRange(inv.created_at, range)) : []), [data, range]);
  const periodTotals = useMemo(() => {
    const invoiced = rows.reduce((s, r) => s + (r.debit || 0), 0);
    const paid = rows.reduce((s, r) => s + (r.credit || 0), 0);
    return { invoiced, paid, outstanding: Math.max(0, invoiced - paid) };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link href="/admin/dashboard-v2/money-admin" className="text-[10px] font-black uppercase text-slate-500 hover:text-rose-600 flex items-center gap-2 transition-colors mb-4">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
            Invoices &amp; Payments <span className="text-rose-600 text-xl align-top">v2</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Line-item detail for one lead — every invoice's individual line items and every payment received, in one chronological statement. No quotes here, just what was billed and received.</p>
        </div>

        {!selectedLead ? (
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, company, phone..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-rose-400"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => selectLead(l)}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
                  >
                    <p className="font-bold text-slate-800">{l.company_name || l.name}</p>
                    <p className="text-slate-400">{l.phone || l.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
            <div>
              <p className="font-bold text-sm text-slate-800">{selectedLead.company_name || selectedLead.name}</p>
              <p className="text-[11px] text-slate-500">{selectedLead.phone || selectedLead.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/statement-v2/${selectedLead.id}`}
                target="_blank"
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
              >
                View Statement <ExternalLink size={12} />
              </Link>
              <button onClick={clearLead} className="text-slate-400 hover:text-slate-600 p-2"><X size={16} /></button>
            </div>
          </div>
        )}

        {loadingLedger && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-rose-500" size={32} />
          </div>
        )}

        {data && !loadingLedger && (
          <>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    period === p.key ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Invoiced ({PERIODS.find((p) => p.key === period)?.label})</p>
                <p className="text-xl font-black tracking-tight mt-1">{rand(periodTotals.invoiced)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paid</p>
                <p className="text-xl font-black tracking-tight mt-1 text-emerald-600">{rand(periodTotals.paid)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outstanding</p>
                <p className="text-xl font-black tracking-tight mt-1 text-rose-600">{rand(periodTotals.outstanding)}</p>
              </div>
            </div>

            {invoicesInPeriod.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {invoicesInPeriod.map((inv) => {
                  const style = statusStyle(inv.status);
                  const StatusIcon = style.icon;
                  return (
                    <span key={inv.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.className}`}>
                      <StatusIcon size={11} /> INV-{inv.invoice_number} · {style.label}
                      {inv.due_at && ` · Due ${fmtDate(inv.due_at)}`}
                    </span>
                  );
                })}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">Nothing billed or received in this period.</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Ref</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3 text-right">Debit</th>
                      <th className="px-5 py-3 text-right">Credit</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let running = 0;
                      return rows.map((r) => {
                        running += (r.debit || 0) - (r.credit || 0);
                        return (
                          <tr key={r.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                            <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-5 py-3 font-mono text-slate-400 whitespace-nowrap">{r.ref}</td>
                            <td className="px-5 py-3">
                              <p className="text-slate-800">{r.desc}</p>
                              {r.meta && <p className="text-slate-400 text-[10px] mt-0.5">{r.meta}</p>}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{r.debit ? rand(r.debit) : ""}</td>
                            <td className="px-5 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">{r.credit ? rand(r.credit) : ""}</td>
                            <td className="px-5 py-3 text-right text-slate-500 whitespace-nowrap">{rand(running)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function StatementsDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500" size={32} /></div>}>
      <StatementsDetailInner />
    </Suspense>
  );
}
