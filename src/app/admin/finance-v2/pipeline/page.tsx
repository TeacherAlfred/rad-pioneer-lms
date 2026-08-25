"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Search, Loader2, ExternalLink, Copy, Download, Send,
  CheckCircle2, XCircle, AlertCircle, Layers, Coins, X, CopyPlus,
  ArrowRightLeft, Receipt, Settings2,
} from "lucide-react";

type EffectiveStatus = "sent" | "expired" | "accepted" | "declined" | "superseded";

function effectiveStatus(quote: any): EffectiveStatus {
  if (quote.status === "sent" && quote.expires_at && new Date(quote.expires_at) < new Date()) return "expired";
  return quote.status;
}

const STATUS_STYLE: Record<EffectiveStatus, { label: string; className: string; icon: any }> = {
  sent: { label: "Open", className: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Send },
  expired: { label: "Expired", className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertCircle },
  accepted: { label: "Accepted", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  declined: { label: "Declined", className: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: XCircle },
  superseded: { label: "Superseded", className: "bg-white/5 text-slate-400 border-white/10", icon: Layers },
};

const TABS: { key: "all" | EffectiveStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Open" },
  { key: "accepted", label: "Accepted" },
  { key: "expired", label: "Expired" },
  { key: "declined", label: "Declined" },
  { key: "superseded", label: "Superseded" },
];

export default function QuotePipelineV2Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | EffectiveStatus>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [manageQuote, setManageQuote] = useState<any>(null);
  const [statusDraft, setStatusDraft] = useState("sent");
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/finance-v2/quotes/list");
      const { quotes: data } = await res.json();
      setQuotes(data || []);
    } catch (err) {
      console.error("Failed to fetch quote pipeline:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      const status = effectiveStatus(quote);
      if (tab !== "all" && status !== tab) return false;
      if (!q) return true;
      const haystack = [
        `qt-${quote.quote_number}`,
        quote.lead?.name,
        quote.lead?.phone,
        quote.lead?.email,
        quote.program?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [quotes, tab, search]);

  const metrics = useMemo(() => {
    const now = new Date();
    const open = quotes.filter((q) => effectiveStatus(q) === "sent");
    const accepted = quotes.filter((q) => effectiveStatus(q) === "accepted");
    const outstanding = accepted.reduce((sum, q) => {
      const owed = (q.invoices || []).reduce(
        (s: number, inv: any) => s + Math.max(0, Number(inv.amount) - Number(inv.amount_paid || 0)),
        0
      );
      return sum + owed;
    }, 0);
    return {
      openCount: open.length,
      openValue: open.reduce((s, q) => s + (Number(q.total_amount) || 0), 0),
      acceptedCount: accepted.length,
      acceptedValue: accepted.reduce((s, q) => s + (Number(q.total_amount) || 0), 0),
      outstanding,
    };
  }, [quotes]);

  const rand = (n: number) => `R ${Math.round(n).toLocaleString()}`;

  async function copyLink(quoteId: string) {
    const url = `${window.location.origin}/quote-v2/${quoteId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(quoteId);
    setTimeout(() => setCopiedId((id) => (id === quoteId ? null : id)), 1500);
  }

  function openManage(quote: any) {
    setManageQuote(quote);
    setStatusDraft(quote.status);
    setActionError(null);
  }

  function closeManage() {
    setManageQuote(null);
    setActionError(null);
  }

  async function submitStatusChange() {
    if (!manageQuote) return;
    setIsActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/quotes/${manageQuote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusDraft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      await fetchQuotes();
      setToast(`QT-${manageQuote.quote_number} marked ${statusDraft}.`);
      closeManage();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActing(false);
    }
  }

  async function acceptOffline(planChoice: "full_term" | "monthly") {
    if (!manageQuote) return;
    setIsActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/quotes/${manageQuote.id}/accept-offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planChoice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to accept quote");
      await fetchQuotes();
      const firstInvoice = json.invoices?.[0];
      setToast(
        `QT-${manageQuote.quote_number} accepted.${firstInvoice ? ` INV-${firstInvoice.invoice_number} created.` : ""}`
      );
      closeManage();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActing(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Row-level shortcut next to the status badge - skips opening the Manage
  // modal entirely for the common case (a single-payment quote has nothing
  // to choose). A quote with a monthly plan still needs the Full Term vs
  // Monthly choice from the modal, so this just opens that instead of
  // guessing which one the admin meant.
  async function quickConvertToInvoice(quote: any) {
    if (quote.installment_count > 1 && quote.monthly_installment_amount) {
      openManage(quote);
      return;
    }
    if (!window.confirm(`Mark QT-${quote.quote_number} as accepted and generate its invoice?`)) return;
    setConvertingId(quote.id);
    try {
      const res = await fetch(`/admin/api/finance-v2/quotes/${quote.id}/accept-offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planChoice: "full_term" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to accept quote");
      await fetchQuotes();
      const firstInvoice = json.invoices?.[0];
      setToast(`QT-${quote.quote_number} accepted.${firstInvoice ? ` INV-${firstInvoice.invoice_number} created.` : ""}`);
    } catch (err: any) {
      setToast(`Failed: ${err.message}`);
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Link href="/admin/dashboard-v2/money-admin" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2 transition-colors mb-4">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
            Quote <span className="text-purple-500">Pipeline</span> <span className="text-cyan-500 text-xl align-top">v2</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Every quote created through the composer or self-serve package selection — the real quotes table, not the old billing_records pipeline.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-6 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open Pipeline</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.openValue)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{metrics.openCount} quote{metrics.openCount === 1 ? "" : "s"}</p>
            </div>
            <Send className="text-purple-500" size={20} />
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-6 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Accepted</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.acceptedValue)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{metrics.acceptedCount} quote{metrics.acceptedCount === 1 ? "" : "s"}</p>
            </div>
            <CheckCircle2 className="text-emerald-500" size={20} />
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-6 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outstanding on Accepted</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(metrics.outstanding)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Unpaid balance on their invoices</p>
            </div>
            <Coins className="text-amber-500" size={20} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t.key ? "bg-white text-[#020617]" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead, phone, quote #..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-purple-500" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-500 text-sm">No quotes match this view.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((quote) => {
              const status = effectiveStatus(quote);
              const style = STATUS_STYLE[status];
              const StatusIcon = style.icon;
              return (
                <div key={quote.id} className="bg-white/[0.03] border border-white/10 rounded-[20px] p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">QT-{quote.quote_number}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.className}`}>
                        <StatusIcon size={11} /> {style.label}
                      </span>
                      {status === "sent" && (
                        <button
                          onClick={() => quickConvertToInvoice(quote)}
                          disabled={convertingId === quote.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                          title="Mark accepted and generate the invoice"
                        >
                          {convertingId === quote.id ? <Loader2 className="animate-spin" size={11} /> : <Receipt size={11} />} Convert to Invoice
                        </button>
                      )}
                      {quote.source === "self_serve" && (
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Self-Serve
                        </span>
                      )}
                      {status === "accepted" && (
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-300 border border-white/10">
                          {quote.accepted_plan_type === "monthly"
                            ? `Split — ${quote.invoices?.length || quote.installment_count} payments`
                            : "One Payment"}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm mt-2 truncate">{quote.lead?.name || "Unknown Lead"}</p>
                    <p className="text-[11px] text-slate-500 truncate">{quote.program?.name || "—"} · {quote.lead?.phone || quote.lead?.email || "No contact"}</p>
                  </div>

                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="text-right">
                      <p className="font-black text-lg tracking-tight">{rand(Number(quote.total_amount) || 0)}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">
                        {status === "sent" || status === "expired"
                          ? `Expires ${quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("en-ZA") : "—"}`
                          : new Date(quote.created_at).toLocaleDateString("en-ZA")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/quote-v2/${quote.id}`}
                        target="_blank"
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                        title="View live quote"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      <button
                        onClick={() => copyLink(quote.id)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                        title="Copy quote link"
                      >
                        {copiedId === quote.id ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                      <a
                        href={`/api/quote-v2/${quote.id}/pdf`}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                        title="Download PDF"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => openManage(quote)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                        title="Manage: status, duplicate, supersede, convert to invoice"
                      >
                        <Settings2 size={14} />
                      </button>
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

      {manageQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={closeManage}>
          <div
            className="bg-[#0b1220] border border-white/10 rounded-[32px] w-full max-w-lg p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manage</p>
                <h3 className="text-xl font-black tracking-tight">QT-{manageQuote.quote_number} · {manageQuote.lead?.name || "Unknown Lead"}</h3>
              </div>
              <button onClick={closeManage} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {actionError && (
              <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{actionError}</p>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
              {manageQuote.status === "accepted" || manageQuote.status === "superseded" ? (
                <p className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  {manageQuote.status === "accepted"
                    ? "This quote has been accepted and invoiced — status can't be changed here."
                    : "This quote has already been superseded."}
                </p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none [color-scheme:dark]"
                  >
                    <option value="sent">Sent (Open)</option>
                    <option value="declined">Declined</option>
                    <option value="expired">Expired</option>
                  </select>
                  <button
                    onClick={submitStatusChange}
                    disabled={isActing || statusDraft === manageQuote.status}
                    className="px-4 py-2.5 rounded-xl bg-white text-[#020617] text-[10px] font-black uppercase disabled:opacity-30"
                  >
                    {isActing ? <Loader2 className="animate-spin" size={14} /> : "Update"}
                  </button>
                </div>
              )}
            </div>

            {manageQuote.status === "accepted" && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Plan</p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-white">
                    {manageQuote.accepted_plan_type === "monthly"
                      ? `Split into ${manageQuote.invoices?.length || manageQuote.installment_count} payments`
                      : "Accepted as one payment"}
                    <span className="text-slate-500 font-normal"> — accepted {manageQuote.accepted_by === "admin" ? "offline, by admin" : "online, by customer"}{manageQuote.accepted_at ? ` on ${new Date(manageQuote.accepted_at).toLocaleDateString("en-ZA")}` : ""}</span>
                  </p>
                  {manageQuote.invoices?.length > 0 && (
                    <div className="space-y-1.5">
                      {manageQuote.invoices.map((inv: any) => {
                        const isPaid = inv.status === "paid";
                        return (
                          <Link
                            key={inv.id}
                            href={`/invoice-v2/${inv.id}`}
                            target="_blank"
                            className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                          >
                            <span className="text-slate-300">INV-{inv.invoice_number}{manageQuote.accepted_plan_type === "monthly" ? ` (${inv.sequence_number}/${manageQuote.installment_count})` : ""}</span>
                            <span className={`font-bold ${isPaid ? "text-emerald-400" : "text-amber-400"}`}>
                              {rand(Number(inv.amount) || 0)} {isPaid ? "· Paid" : "· Unpaid"}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push(`/admin/finance-v2/composer?duplicate=${manageQuote.id}`)}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 text-left transition-all"
              >
                <CopyPlus className="text-cyan-400 mb-2" size={18} />
                <p className="text-xs font-black uppercase">Duplicate</p>
                <p className="text-[10px] text-slate-500 mt-1">New, unlinked quote using this as a base.</p>
              </button>
              <button
                onClick={() => router.push(`/admin/finance-v2/composer?supersede=${manageQuote.id}`)}
                disabled={manageQuote.status === "superseded"}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 text-left transition-all disabled:opacity-30"
              >
                <ArrowRightLeft className="text-amber-400 mb-2" size={18} />
                <p className="text-xs font-black uppercase">Supersede</p>
                <p className="text-[10px] text-slate-500 mt-1">Replace with updated pricing/items — this one gets marked superseded.</p>
              </button>
            </div>

            {manageQuote.status === "sent" && (
              <div className="border-t border-white/5 pt-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Convert to Invoice</p>
                <p className="text-[11px] text-slate-500">Client agreed offline (phone/WhatsApp)? Mark this quote accepted and generate the invoice(s) directly — same effect as them clicking Accept on the live quote.</p>
                {manageQuote.installment_count > 1 && manageQuote.monthly_installment_amount ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptOffline("full_term")}
                      disabled={isActing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase disabled:opacity-40"
                    >
                      Full Term
                    </button>
                    <button
                      onClick={() => acceptOffline("monthly")}
                      disabled={isActing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase disabled:opacity-40"
                    >
                      Monthly ×{manageQuote.installment_count}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => acceptOffline("full_term")}
                    disabled={isActing}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {isActing ? <Loader2 className="animate-spin" size={14} /> : <><Receipt size={14} /> Mark Accepted &amp; Generate Invoice</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
