"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, X, Loader2, Search, Wallet, FileText } from "lucide-react";

type Payment = { id: string; amount: number; received_at: string; note: string | null };
type Balance = {
  id: string;
  lead_id: string;
  lead: { id: string; name: string | null; phone: string | null; email: string | null; company_name: string | null } | null;
  amount: number;
  as_of_date: string;
  legacy_reference: string | null;
  description: string | null;
  payments: Payment[];
  paid: number;
  outstanding: number;
};
type Lead = { id: string; name: string | null; phone: string | null; email: string | null; company_name: string | null };
type Guardian = { id: string; display_name: string; phone: string; email: string };
type LegacyInvoice = { id: string; invoice_number: number; status: string; total_amount: number; amount_paid: number; created_at: string; doc_type: string };

const emptyAddForm = { amount: "", as_of_date: "", legacy_reference: "", description: "" };

export default function BalancesPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [suggestedLeads, setSuggestedLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [guardianSearch, setGuardianSearch] = useState("");
  const [suggestedGuardians, setSuggestedGuardians] = useState<Guardian[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [legacyInvoices, setLegacyInvoices] = useState<LegacyInvoice[]>([]);
  const [loadingLegacyInvoices, setLoadingLegacyInvoices] = useState(false);

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Balance | null>(null);
  const [editForm, setEditForm] = useState(emptyAddForm);

  const [payingBalance, setPayingBalance] = useState<Balance | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", received_at: new Date().toISOString().split("T")[0], note: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/admin/api/finance-v2/balances");
    const data = await res.json();
    setBalances(data.balances || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (leadSearch.length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(leadSearch)}`);
        const { leads } = await res.json();
        setSuggestedLeads(leads || []);
      }, 250);
      return () => clearTimeout(t);
    } else {
      setSuggestedLeads([]);
    }
  }, [leadSearch]);

  useEffect(() => {
    if (guardianSearch.length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/balances/legacy-guardians?q=${encodeURIComponent(guardianSearch)}`);
        const { guardians } = await res.json();
        setSuggestedGuardians(guardians || []);
      }, 250);
      return () => clearTimeout(t);
    } else {
      setSuggestedGuardians([]);
    }
  }, [guardianSearch]);

  async function selectGuardian(g: Guardian) {
    setSelectedGuardian(g);
    setGuardianSearch("");
    setSuggestedGuardians([]);
    setLoadingLegacyInvoices(true);
    const res = await fetch(`/admin/api/finance-v2/balances/legacy-invoices?guardian_id=${g.id}`);
    const data = await res.json();
    setLegacyInvoices(data.invoices || []);
    setLoadingLegacyInvoices(false);
  }

  function pickLegacyInvoice(inv: LegacyInvoice) {
    setAddForm((f) => ({ ...f, legacy_reference: `INV-${inv.invoice_number}` }));
  }

  function openAdd() {
    setSelectedLead(null);
    setLeadSearch("");
    setSelectedGuardian(null);
    setGuardianSearch("");
    setLegacyInvoices([]);
    setAddForm(emptyAddForm);
    setError(null);
    setShowAddModal(true);
  }

  async function saveAdd() {
    if (!selectedLead) return setError("Select a lead first.");
    if (!addForm.amount || Number(addForm.amount) <= 0) return setError("Amount must be a positive number.");
    if (!addForm.as_of_date) return setError("As-of date is required.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/finance-v2/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          amount: Number(addForm.amount),
          as_of_date: addForm.as_of_date,
          legacy_reference: addForm.legacy_reference.trim() || null,
          description: addForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setShowAddModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b: Balance) {
    setEditing(b);
    setEditForm({
      amount: String(b.amount),
      as_of_date: b.as_of_date,
      legacy_reference: b.legacy_reference || "",
      description: b.description || "",
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.amount || Number(editForm.amount) <= 0) return setError("Amount must be a positive number.");
    if (!editForm.as_of_date) return setError("As-of date is required.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/balances/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(editForm.amount),
          as_of_date: editForm.as_of_date,
          legacy_reference: editForm.legacy_reference.trim() || null,
          description: editForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setEditing(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: Balance) {
    if (!confirm(`Delete the brought-forward balance for ${b.lead?.name || "this lead"}? This also deletes any logged payments against it.`)) return;
    await fetch(`/admin/api/finance-v2/balances/${b.id}`, { method: "DELETE" });
    await load();
  }

  function openPay(b: Balance) {
    setPayingBalance(b);
    setPaymentForm({ amount: String(b.outstanding > 0 ? b.outstanding : ""), received_at: new Date().toISOString().split("T")[0], note: "" });
    setError(null);
  }

  async function savePayment() {
    if (!payingBalance) return;
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return setError("Amount must be a positive number.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/finance-v2/balances/${payingBalance.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          received_at: paymentForm.received_at,
          note: paymentForm.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setPayingBalance(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const rand = (n: number) => `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin/finance-v2/pipeline" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Pipeline
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet size={20} className="text-blue-500" /> Balances Brought Forward
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Outstanding balances from the legacy finance system, entered manually per client so tracking moves fully into v2. Payments logged here count toward the real Cash Waterfall running balance.
            </p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shrink-0">
            <Plus size={14} /> Add Balance
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm">{b.lead?.company_name || b.lead?.name || "Unknown lead"}</h3>
                      {b.legacy_reference && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{b.legacy_reference}</span>
                      )}
                      {b.outstanding <= 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Settled</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {rand(b.amount)} as of {new Date(b.as_of_date + "T00:00:00").toLocaleDateString("en-ZA")}
                      {b.paid > 0 && <> — {rand(b.paid)} paid, {rand(b.outstanding)} outstanding</>}
                    </p>
                    {b.description && <p className="text-xs text-slate-500 mt-1">{b.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/statement-v2/${b.lead_id}`} target="_blank" className="text-slate-300 hover:text-slate-600" title="View statement">
                      <FileText size={14} />
                    </Link>
                    <button onClick={() => openPay(b)} className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 px-2">Log Payment</button>
                    <button onClick={() => openEdit(b)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                    <button onClick={() => remove(b)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                {b.payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    {b.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{new Date(p.received_at + "T00:00:00").toLocaleDateString("en-ZA")}{p.note ? ` — ${p.note}` : ""}</span>
                        <span className="font-bold text-emerald-600">{rand(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {balances.length === 0 && <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No brought-forward balances yet.</div>}
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg p-7 space-y-5 my-8">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-slate-900">Bring Forward a Balance</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">1. Lead (v2)</label>
                {!selectedLead ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Search leads by name or phone..." className="w-full bg-white border border-slate-200 rounded-[10px] py-2.5 pl-9 pr-3.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                    </div>
                    {suggestedLeads.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        {suggestedLeads.map((l) => (
                          <button key={l.id} onClick={() => { setSelectedLead(l); setLeadSearch(""); setSuggestedLeads([]); }} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 text-[13px]">
                            {l.company_name || l.name || "Unnamed"} <span className="text-slate-400 text-[11px] ml-2">{l.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-[13px] font-bold text-blue-900">{selectedLead.company_name || selectedLead.name || "Unnamed"} <span className="font-normal text-blue-600">· {selectedLead.phone}</span></span>
                    <button onClick={() => setSelectedLead(null)} className="text-blue-400 hover:text-blue-700"><X size={14} /></button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">2. Find matching old-system client (optional)</label>
                {!selectedGuardian ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input value={guardianSearch} onChange={(e) => setGuardianSearch(e.target.value)} placeholder="Search legacy guardians by name..." className="w-full bg-white border border-slate-200 rounded-[10px] py-2.5 pl-9 pr-3.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                    </div>
                    {suggestedGuardians.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        {suggestedGuardians.map((g) => (
                          <button key={g.id} onClick={() => selectGuardian(g)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 text-[13px]">
                            {g.display_name} <span className="text-slate-400 text-[11px] ml-2">{g.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[13px] font-bold text-slate-700">{selectedGuardian.display_name}</span>
                      <button onClick={() => { setSelectedGuardian(null); setLegacyInvoices([]); }} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
                    </div>
                    {loadingLegacyInvoices ? (
                      <div className="text-[12px] text-slate-400 flex items-center gap-2 px-1"><Loader2 size={12} className="animate-spin" /> Loading legacy invoices...</div>
                    ) : legacyInvoices.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        {legacyInvoices.map((inv) => (
                          <button key={inv.id} onClick={() => pickLegacyInvoice(inv)} className={`w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 text-[12px] flex items-center justify-between ${addForm.legacy_reference === `INV-${inv.invoice_number}` ? "bg-blue-50" : ""}`}>
                            <span>INV-{inv.invoice_number} · {inv.status}</span>
                            <span className="text-slate-400">{rand(inv.total_amount)} ({new Date(inv.created_at).toLocaleDateString("en-ZA")})</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-400 px-1">No legacy invoices found for this guardian.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">3. Amount (R)</label>
                  <input type="number" value={addForm.amount} onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">As-of Date</label>
                  <input type="date" value={addForm.as_of_date} onChange={(e) => setAddForm((f) => ({ ...f, as_of_date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-3">Always typed in by hand, even if you picked a legacy invoice above — it may differ from that record's own total.</p>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Legacy Reference</label>
                <input value={addForm.legacy_reference} onChange={(e) => setAddForm((f) => ({ ...f, legacy_reference: e.target.value }))} placeholder="e.g. INV-1122, INV-1116" className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Description</label>
                <textarea value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="What this balance is for" className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>

              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                <button onClick={saveAdd} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-slate-900">Edit Balance — {editing.lead?.name || "Unknown lead"}</h3>
                <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Amount (R)</label>
                  <input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">As-of Date</label>
                  <input type="date" value={editForm.as_of_date} onChange={(e) => setEditForm((f) => ({ ...f, as_of_date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Legacy Reference</label>
                <input value={editForm.legacy_reference} onChange={(e) => setEditForm((f) => ({ ...f, legacy_reference: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>
              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        )}

        {payingBalance && (
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-sm p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-slate-900">Log Payment</h3>
                <button onClick={() => setPayingBalance(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <p className="text-[12px] text-slate-500">{payingBalance.lead?.name} — outstanding {rand(payingBalance.outstanding)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Amount (R)</label>
                  <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Date</label>
                  <input type="date" value={paymentForm.received_at} onChange={(e) => setPaymentForm((f) => ({ ...f, received_at: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Note (optional)</label>
                <input value={paymentForm.note} onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>
              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPayingBalance(null)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                <button onClick={savePayment} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
