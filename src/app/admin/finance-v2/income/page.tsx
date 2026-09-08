"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, Coins, Plus, ChevronDown, ChevronUp, X, Save } from "lucide-react";
import { ExpenseAllocationEditor, NEW_EXPENSE_SENTINEL, emptyExpenseAllocationRow, type ExpenseAllocationRow } from "@/components/finance/ExpenseAllocationEditor";

type IncomeRow = {
  id: string;
  date: string;
  amount: number;
  allocated: number;
  invoiceRef: string | null;
  method: string | null;
  note: string | null;
  lead: { id: string; name: string | null; phone: string | null; email: string | null; company_name: string | null } | null;
  earmarks: { id: string; name: string; amount: number }[];
  canEarmark: boolean;
};

const rand = (n: number) => `R ${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

export default function IncomePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [search, setSearch] = useState("");
  const [standingExpenses, setStandingExpenses] = useState<any[]>([]);

  // Only one payment's earmark editor open at a time - draftRows resets
  // whenever a different row is expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<ExpenseAllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadIncome() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/finance-v2/income");
      const { payments } = await res.json();
      setRows(payments || []);
    } catch (err) {
      console.error("Failed to fetch income:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncome();
    (async () => {
      const res = await fetch("/admin/api/finance-v2/expenses");
      const { expenses } = await res.json();
      setStandingExpenses((expenses || []).filter((e: any) => e.active));
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.lead?.name, r.lead?.company_name, r.lead?.phone, r.lead?.email, r.invoiceRef]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(
    () => filtered.reduce((acc, r) => ({ amount: acc.amount + r.amount, allocated: acc.allocated + r.allocated }), { amount: 0, allocated: 0 }),
    [filtered]
  );

  function toggleEarmarkEditor(row: IncomeRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      setDraftRows([]);
      return;
    }
    setExpandedId(row.id);
    setDraftRows([emptyExpenseAllocationRow()]);
  }
  function addDraftRow() {
    setDraftRows((prev) => [...prev, emptyExpenseAllocationRow()]);
  }
  function removeDraftRow(key: string) {
    setDraftRows((prev) => prev.filter((r) => r.key !== key));
  }
  function updateDraftRow(key: string, patch: Partial<ExpenseAllocationRow>) {
    setDraftRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function saveEarmarks(row: IncomeRow) {
    const validRows = draftRows
      .filter((r) => Number(r.amount) > 0 && r.name.trim() && (r.expenseId !== NEW_EXPENSE_SENTINEL || r.dueDate))
      .map((r) => ({
        expense_id: r.expenseId === NEW_EXPENSE_SENTINEL ? null : r.expenseId,
        name: r.name.trim(),
        amount: Number(r.amount),
        due_date: r.dueDate || undefined,
        recurring: r.recurring,
      }));
    if (validRows.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/admin/api/finance-v2/income/${row.id}/earmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense_allocations: validRows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to earmark payment");
      setExpandedId(null);
      setDraftRows([]);
      await loadIncome();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEarmark(earmarkId: string) {
    setDeletingId(earmarkId);
    try {
      await fetch(`/admin/api/finance-v2/income/earmarks/${earmarkId}`, { method: "DELETE" });
      await loadIncome();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link href="/admin/dashboard-v2/money-admin" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-600 flex items-center gap-2 transition-colors mb-4">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
            Income <span className="text-emerald-600 text-xl align-top">v2</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Every payment received, and how much of it was allocated against a real invoice — a legacy balance-forward payment shows R0 allocated, since there's no v2 invoice behind it.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Received</p>
            <p className="text-2xl font-black tracking-tight mt-1 text-emerald-600">{rand(totals.amount)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Allocated to Invoices</p>
            <p className="text-2xl font-black tracking-tight mt-1">{rand(totals.allocated)}</p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, company, invoice..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-emerald-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">No payments match this view.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Allocated to Invoice</th>
                  <th className="px-5 py-3">Paid For</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const earmarkedSoFar = r.earmarks.reduce((s, e) => s + e.amount, 0);
                  const draftTotal = draftRows.reduce((s, dr) => s + (Number(dr.amount) || 0), 0);
                  const remaining = r.amount - earmarkedSoFar - draftTotal;
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-ZA")}</td>
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-800">{r.lead?.company_name || r.lead?.name || "Unknown"}</p>
                          <p className="text-[10px] text-slate-400">{r.lead?.phone || r.lead?.email || ""}{r.method ? ` · ${r.method}` : ""}</p>
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-800 whitespace-nowrap">{rand(r.amount)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {r.allocated > 0 ? (
                            <>
                              <span className="font-bold text-emerald-600">{rand(r.allocated)}</span>
                              {r.invoiceRef && <span className="text-slate-400 font-mono text-[10px] ml-1.5">{r.invoiceRef}</span>}
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Unallocated (legacy balance)</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {r.earmarks.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {r.earmarks.map((e) => (
                                <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold whitespace-nowrap">
                                  {e.name} <span className="text-purple-400">{rand(e.amount)}</span>
                                  <button onClick={() => deleteEarmark(e.id)} disabled={deletingId === e.id} className="text-purple-300 hover:text-rose-500 disabled:opacity-50">
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[11px] italic">Into the pool</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {r.canEarmark && (
                            <button
                              onClick={() => toggleEarmarkEditor(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-200 text-[9px] font-black uppercase tracking-widest transition-all"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <Plus size={12} />} Earmark
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-purple-50/30 border-b border-slate-100">
                          <td colSpan={6} className="px-5 py-5">
                            <div className="space-y-3">
                              <ExpenseAllocationEditor
                                rows={draftRows}
                                standingExpenses={standingExpenses}
                                onRemove={removeDraftRow}
                                onUpdate={updateDraftRow}
                                remaining={remaining}
                                totalLabel="Earmarking now"
                                remainingLabel="Still unmarked after this"
                              />
                              <div className="flex items-center gap-2">
                                <button onClick={addDraftRow} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-purple-300 flex items-center gap-1.5">
                                  <Plus size={12} /> Add Another
                                </button>
                                <button
                                  onClick={() => saveEarmarks(r)}
                                  disabled={saving}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                                </button>
                                <button onClick={() => toggleEarmarkEditor(r)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
