"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, X, Loader2, RefreshCw, Wallet } from "lucide-react";

type Expense = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  payment_timing: "pre_paid" | "post_paid";
  recurring: boolean;
  active: boolean;
};

const emptyForm = { name: "", amount: "", due_date: "", payment_timing: "post_paid" as const, recurring: false, active: true };

export default function StandingExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [expRes, waterfallRes] = await Promise.all([
      fetch("/admin/api/finance-v2/expenses"),
      fetch("/admin/api/finance-v2/cash-waterfall"),
    ]);
    const expData = await expRes.json();
    const waterfallData = await waterfallRes.json();
    setRows(expData.expenses || []);
    setNeedsConfirmation(waterfallData.needsConfirmation || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }
  function openEdit(exp: Expense) {
    setEditing(exp);
    setForm({ name: exp.name, amount: String(exp.amount), due_date: exp.due_date, payment_timing: exp.payment_timing, recurring: exp.recurring, active: exp.active });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) return setError("Name is required.");
    if (!form.amount || Number(form.amount) <= 0) return setError("Amount must be a positive number.");
    if (!form.due_date) return setError("Due date is required.");
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, name: form.name.trim(), amount: Number(form.amount) };
      const res = await fetch(editing ? `/admin/api/finance-v2/expenses/${editing.id}` : "/admin/api/finance-v2/expenses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(exp: Expense) {
    if (!confirm(`Delete "${exp.name}"?`)) return;
    await fetch(`/admin/api/finance-v2/expenses/${exp.id}`, { method: "DELETE" });
    await load();
  }

  async function confirmNext(exp: Expense) {
    setConfirmingId(exp.id);
    try {
      const res = await fetch(`/admin/api/finance-v2/expenses/${exp.id}/confirm-next`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmingId(null);
    }
  }

  const rand = (n: number) => `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin/dashboard-v2/money-admin" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Money &amp; Admin
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet size={20} className="text-blue-500" /> Standing Expenses
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Recurring/fixed costs that exist regardless of sales volume — rent, subscriptions, admin overhead. Delivery-linked costs (educator time, venue, materials tied to specific bookings) aren&apos;t entered here — they roll up automatically from the <Link href="/admin/pricing" className="underline hover:text-slate-700">Pricing Library</Link>.
            </p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shrink-0">
            <Plus size={14} /> Add Expense
          </button>
        </div>

        {needsConfirmation.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-[13px] font-bold text-amber-700">Recurring expenses due for next month's instance</p>
            {needsConfirmation.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-xl px-4 py-2.5">
                <span className="text-[13px] text-slate-700">{exp.name} — {rand(exp.amount)}</span>
                <button
                  onClick={() => confirmNext(exp)}
                  disabled={confirmingId === exp.id}
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 disabled:opacity-50"
                >
                  {confirmingId === exp.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Create Next Month
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-2">
            {rows.map((exp) => (
              <div key={exp.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm">{exp.name}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{exp.payment_timing.replace("_", "-")}</span>
                    {exp.recurring && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Recurring</span>}
                    {!exp.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{rand(exp.amount)} — due {new Date(exp.due_date + "T00:00:00").toLocaleDateString("en-ZA")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(exp)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(exp)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No standing expenses yet.</div>}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-slate-900">{editing ? "Edit Expense" : "New Standing Expense"}</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. Office rent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Amount (R)</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Due Date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Timing (descriptive only — doesn't affect waterfall order)</label>
                <select value={form.payment_timing} onChange={(e) => setForm((f) => ({ ...f, payment_timing: e.target.value as any }))} className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none appearance-none cursor-pointer">
                  <option value="pre_paid">Pre-paid</option>
                  <option value="post_paid">Post-paid</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} className="w-4 h-4 accent-blue-600" /> Recurring (prompts to create next month's instance once this one's due date passes)
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-blue-600" /> Active
              </label>
              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
