"use client";

import { X } from "lucide-react";

// Shared by Capture Payment (earmarking at the moment cash comes in) and the
// Income page's retroactive earmark editor (annotating a payment captured
// before this existed) - same row shape, same "pick an existing standing
// expense or type a new one" behavior either way. Purely a bookkeeping note;
// see src/lib/incomeExpenseAllocations.ts for what actually gets persisted.
export const NEW_EXPENSE_SENTINEL = "__new__";

export type ExpenseAllocationRow = {
  key: string;
  expenseId: string; // NEW_EXPENSE_SENTINEL while "+ Add new expense" is selected
  name: string;
  amount: string;
  dueDate: string;
  recurring: boolean;
};

export function emptyExpenseAllocationRow(): ExpenseAllocationRow {
  return { key: crypto.randomUUID(), expenseId: NEW_EXPENSE_SENTINEL, name: "", amount: "", dueDate: "", recurring: false };
}

export function ExpenseAllocationEditor({
  rows,
  standingExpenses,
  onRemove,
  onUpdate,
  remaining,
  totalLabel = "Earmarked",
  remainingLabel = "Into the pool, unmarked",
  accentColor = "purple",
}: {
  rows: ExpenseAllocationRow[];
  standingExpenses: { id: string; name: string; amount: number }[];
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ExpenseAllocationRow>) => void;
  remaining: number;
  totalLabel?: string;
  remainingLabel?: string;
  accentColor?: "purple" | "blue";
}) {
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const focusRing = accentColor === "blue" ? "focus:border-blue-400" : "focus:border-purple-400";
  const accentCheckbox = accentColor === "blue" ? "accent-blue-600" : "accent-purple-600";

  function selectExpense(key: string, expenseId: string) {
    if (expenseId === NEW_EXPENSE_SENTINEL) {
      onUpdate(key, { expenseId, name: "", dueDate: "", recurring: false });
      return;
    }
    const match = standingExpenses.find((e) => e.id === expenseId);
    onUpdate(key, { expenseId, name: match?.name || "" });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={row.expenseId}
              onChange={(e) => selectExpense(row.key, e.target.value)}
              className={`flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none ${focusRing}`}
            >
              <option value={NEW_EXPENSE_SENTINEL}>+ Add new standing expense...</option>
              {standingExpenses.map((e) => (
                <option key={e.id} value={e.id}>{e.name} (R {Number(e.amount).toLocaleString()})</option>
              ))}
            </select>
            <div className="relative w-32 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">R</span>
              <input
                type="number" min="0" placeholder="0.00" value={row.amount}
                onChange={(e) => onUpdate(row.key, { amount: e.target.value })}
                className={`w-full border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-right font-black outline-none bg-white text-slate-900 ${focusRing}`}
              />
            </div>
            <button onClick={() => onRemove(row.key)} className="p-2 text-slate-400 hover:text-rose-500 shrink-0"><X size={16} /></button>
          </div>

          {row.expenseId === NEW_EXPENSE_SENTINEL && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-1">
              <input
                type="text" placeholder="Expense name (e.g. Printer toner)" value={row.name}
                onChange={(e) => onUpdate(row.key, { name: e.target.value })}
                className={`sm:col-span-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none ${focusRing}`}
              />
              <input
                type="date" value={row.dueDate}
                onChange={(e) => onUpdate(row.key, { dueDate: e.target.value })}
                className={`bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none ${focusRing}`}
              />
              <label className="sm:col-span-3 flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={row.recurring} onChange={(e) => onUpdate(row.key, { recurring: e.target.checked })} className={`w-3.5 h-3.5 ${accentCheckbox}`} />
                Recurring (prompts to create next month's instance once this one's due date passes)
              </label>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between px-1 pt-1">
        <p className="text-[10px] font-bold text-slate-500">{totalLabel}: R {total.toLocaleString()}</p>
        <p className="text-[10px] font-bold text-slate-500">
          {remainingLabel}: <span className={remaining < 0 ? "text-rose-600" : "text-emerald-600"}>R {remaining.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
