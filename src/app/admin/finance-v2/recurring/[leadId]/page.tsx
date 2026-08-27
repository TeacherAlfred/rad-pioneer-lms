"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Loader2, Repeat, Pause, Play, Ban, Send, Plus,
  Trash2, Save, CheckCircle2, X, ArrowRight,
} from "lucide-react";

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  customer_type: string;
  company_name: string | null;
  billing_address: string | null;
};

type AcceptedQuote = { id: string; quote_number: number; total_amount: number; status: string };

type RecurringPlan = {
  id: string;
  lead_id: string;
  source_quote_id: string | null;
  line_items: { description: string; quantity: number; unit_price: number; discount_pct?: number }[];
  total_amount: number;
  frequency: string;
  next_due_date: string;
  status: "active" | "paused" | "cancelled";
  last_generated_invoice_id: string | null;
  notes: string | null;
};

type QuoteLineItem = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number };

type QuoteInvoice = { id: string; invoice_number: number; amount: number; amount_paid: number; status: string; due_at: string };

function lastDayOfMonthISO() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RecurringBillingPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [invoices, setInvoices] = useState<QuoteInvoice[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlanQuoteId, setNewPlanQuoteId] = useState("");
  const [newPlanNextDue, setNewPlanNextDue] = useState(lastDayOfMonthISO);
  const [savingPlan, setSavingPlan] = useState(false);

  const [editItems, setEditItems] = useState<{ description: string; quantity: number; unit_price: number; discount_pct: number }[]>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.status !== "cancelled");

  useEffect(() => {
    if (leadId) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch(`/admin/api/finance-v2/recurring-plans?lead_id=${leadId}`);
    if (res.ok) {
      const { lead: l, acceptedQuotes: q, plans: p } = await res.json();
      setLead(l);
      setAcceptedQuotes(q || []);
      setPlans(p || []);
      const plan = (p || []).find((pl: RecurringPlan) => pl.status !== "cancelled");
      if (plan?.source_quote_id) await fetchQuote(plan.source_quote_id);
    }
    setLoading(false);
  }

  async function fetchQuote(quoteId: string) {
    const res = await fetch(`/api/finance-v2/quotes/${quoteId}`);
    if (!res.ok) return;
    const { quote, lineItems, invoices: inv } = await res.json();
    setInvoices(inv || []);
    setEditItems((lineItems || []).map((li: QuoteLineItem) => ({
      description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), discount_pct: Number(li.discount_pct) || 0,
    })));
    setEditDueDate(quote.expires_at ? new Date(quote.expires_at).toISOString().split("T")[0] : lastDayOfMonthISO());
  }

  async function handleCreatePlan() {
    if (!newPlanQuoteId) {
      alert("Choose an accepted quote to link this plan to.");
      return;
    }
    const quote = acceptedQuotes.find((q) => q.id === newPlanQuoteId);
    if (!quote) return;
    setSavingPlan(true);
    try {
      const res = await fetch("/admin/api/finance-v2/recurring-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          source_quote_id: quote.id,
          line_items: [{ description: "Recurring charge", quantity: 1, unit_price: quote.total_amount, discount_pct: 0 }],
          total_amount: quote.total_amount,
          next_due_date: newPlanNextDue,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create recurring plan");
      setShowCreateForm(false);
      setMessage("Recurring plan created.");
      await fetchAll();
    } catch (err: any) {
      alert("Operational Failure: " + err.message);
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleGenerate(planId: string, send: boolean) {
    setBusyPlanId(planId);
    try {
      const res = await fetch(`/admin/api/finance-v2/recurring-plans/${planId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate invoice");
      setMessage(json.warning || (send ? "Invoice generated and emailed." : "Invoice generated (not emailed)."));
      await fetchAll();
    } catch (err: any) {
      alert("Operational Failure: " + err.message);
    } finally {
      setBusyPlanId(null);
    }
  }

  async function handleSetStatus(planId: string, status: "active" | "paused" | "cancelled") {
    setBusyPlanId(planId);
    try {
      const res = await fetch(`/admin/api/finance-v2/recurring-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update plan status");
      await fetchAll();
    } catch (err: any) {
      alert("Operational Failure: " + err.message);
    } finally {
      setBusyPlanId(null);
    }
  }

  function updateEditItem(idx: number, patch: Partial<{ description: string; quantity: number; unit_price: number; discount_pct: number }>) {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const editTotal = editItems.reduce((sum, it) => sum + it.quantity * it.unit_price * (1 - Math.max(0, it.discount_pct) / 100), 0);

  async function handleSaveQuoteEdit() {
    if (!activePlan?.source_quote_id) return;
    if (editItems.length === 0 || editItems.some((it) => !it.description || it.quantity <= 0 || it.unit_price < 0)) {
      setEditError("Every line needs a description, a quantity above 0, and a fee.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/quotes/${activePlan.source_quote_id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items: editItems, expires_at: editDueDate || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save changes");
      setMessage("Quote updated.");
      await fetchAll();
    } catch (err: any) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Loading...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white gap-4">
        <p className="font-black uppercase italic">Lead not found</p>
        <Link href="/admin/finance-v2/pipeline" className="text-emerald-400 underline text-sm">Back to Pipeline</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-4 border-b border-white/5 pb-8">
          <Link href="/admin/finance-v2/pipeline" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2 transition-colors w-fit">
            <ArrowLeft size={14} /> Back to Pipeline
          </Link>
          <div className="flex items-center gap-2 text-blue-400">
            <Building2 size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Recurring Billing</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">
            {lead.company_name || lead.name || "Lead"}
          </h1>
          <p className="text-[11px] text-slate-500">{lead.email || "No email"} · {lead.phone}</p>
        </header>

        {message && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] font-bold text-emerald-300 flex items-center justify-between gap-4">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-emerald-400/60 hover:text-emerald-300 shrink-0"><X size={14} /></button>
          </div>
        )}

        {!activePlan ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 flex items-center gap-2"><Repeat size={16} /> No Recurring Plan</h3>
            {!showCreateForm ? (
              acceptedQuotes.length > 0 ? (
                <button onClick={() => setShowCreateForm(true)} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus size={14} /> Set Up Recurring Invoice
                </button>
              ) : (
                <p className="text-xs text-slate-500">This lead has no accepted quote yet to link a recurring plan to.</p>
              )
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Link to an accepted quote</label>
                  <select value={newPlanQuoteId} onChange={(e) => setNewPlanQuoteId(e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-purple-500 mt-1">
                    <option value="">— choose a quote —</option>
                    {acceptedQuotes.map((q) => (
                      <option key={q.id} value={q.id}>QT-{q.quote_number} (R{q.total_amount})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Next Due Date</label>
                  <input type="date" value={newPlanNextDue} onChange={(e) => setNewPlanNextDue(e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-purple-500 mt-1 [color-scheme:dark]" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCreatePlan} disabled={savingPlan} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40">
                    {savingPlan ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save Plan
                  </button>
                  <button onClick={() => setShowCreateForm(false)} className="px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* QUOTE EDITOR */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Source Quote Terms</h3>
                <button
                  onClick={() => setEditItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0, discount_pct: 0 }])}
                  className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> Add Line
                </button>
              </div>
              <div className="space-y-4">
                {editItems.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 md:items-end">
                    <div className="flex-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Description</label>
                      <input value={item.description} onChange={(e) => updateEditItem(idx, { description: e.target.value })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500 mt-1" />
                    </div>
                    <div className="w-full md:w-24">
                      <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Qty</label>
                      <input type="number" step="0.01" value={item.quantity} onChange={(e) => updateEditItem(idx, { quantity: Number(e.target.value) || 0 })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center outline-none focus:border-emerald-500" />
                    </div>
                    <div className="w-full md:w-32">
                      <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Fee / Unit (R)</label>
                      <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateEditItem(idx, { unit_price: Number(e.target.value) || 0 })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center outline-none focus:border-emerald-500" />
                    </div>
                    {editItems.length > 1 && (
                      <button onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-rose-500 transition-colors shrink-0 pb-3">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Due Date</label>
                <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500 mt-1 [color-scheme:dark]" />
                <p className="text-[9px] text-slate-500 mt-1.5">Defaults to the last day of the current month.</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <p className="text-lg font-black italic text-white">Total: R {editTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              {editError && <p className="text-xs font-bold text-rose-400">{editError}</p>}
              <p className="text-[10px] text-slate-500">Saving updates the quote and this recurring plan&apos;s billed amount going forward.</p>
              <button onClick={handleSaveQuoteEdit} disabled={savingEdit} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40">
                {savingEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
              </button>
            </div>

            {/* RECURRING PLAN */}
            {plans.filter((p) => p.status !== "cancelled").map((plan) => {
              const isPaused = plan.status === "paused";
              const daysUntilDue = Math.ceil((new Date(plan.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const dueLabel = daysUntilDue <= 0 ? "Due now" : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
              const busy = busyPlanId === plan.id;
              return (
                <div key={plan.id} className={`p-6 rounded-[32px] border space-y-4 ${isPaused ? "bg-white/[0.02] border-white/5 opacity-70" : "bg-purple-500/5 border-purple-500/20"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-2xl font-black italic text-white">R {Number(plan.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500 uppercase not-italic">/ {plan.frequency}</span></p>
                      <p className="text-[10px] text-slate-400 mt-1">{plan.line_items?.[0]?.description || "Recurring charge"}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isPaused ? "bg-slate-500/10 text-slate-400 border-slate-500/20" : daysUntilDue <= 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                      {isPaused ? "Paused" : dueLabel}
                    </span>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Next due: {new Date(plan.next_due_date).toLocaleDateString("en-ZA")}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                    {!isPaused && (
                      <>
                        <button disabled={busy} onClick={() => handleGenerate(plan.id, true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-40">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Generate &amp; Send Invoice
                        </button>
                        <button disabled={busy} onClick={() => handleGenerate(plan.id, false)} className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                          Generate Only
                        </button>
                      </>
                    )}
                    <button disabled={busy} onClick={() => handleSetStatus(plan.id, isPaused ? "active" : "paused")} className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-40 ml-auto">
                      {isPaused ? <Play size={14} /> : <Pause size={14} />} {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button disabled={busy} onClick={() => { if (confirm("Cancel this recurring plan? This cannot be undone.")) handleSetStatus(plan.id, "cancelled"); }} className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-40">
                      <Ban size={14} /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}

            {/* INVOICE HISTORY */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Invoice History</h3>
              </div>
              {invoices.length === 0 ? (
                <p className="p-8 text-center text-slate-500 font-bold italic text-xs">No invoices generated yet.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-black/20 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Invoice</th>
                      <th className="px-6 py-3">Due</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-6 py-4 text-xs font-black text-white">INV-{inv.invoice_number}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">{new Date(inv.due_at).toLocaleDateString("en-ZA")}</td>
                        <td className="px-6 py-4 text-xs font-black text-white text-right">R {Number(inv.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300">{inv.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a href={`/invoice-v2/${inv.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase">
                            View <ArrowRight size={12} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
