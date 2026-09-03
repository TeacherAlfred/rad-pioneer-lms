"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  sort_order: number;
};

export function ChecklistEditor({ projectId, items, onChange }: { projectId: string; items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const label = newLabel.trim();
    if (!label || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/${projectId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange([...items, json.item]);
      setNewLabel("");
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(item: ChecklistItem) {
    const nextDone = !item.done;
    onChange(items.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it)));
    await fetch(`/admin/api/dashboard-v2/projects/${projectId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: nextDone }),
    });
  }

  async function removeItem(item: ChecklistItem) {
    onChange(items.filter((it) => it.id !== item.id));
    await fetch(`/admin/api/dashboard-v2/projects/${projectId}/checklist/${item.id}`, { method: "DELETE" });
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">Checklist</h2>
        {items.length > 0 && (
          <span className="text-[11px] font-black text-stone-400">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {items.length === 0 && <p className="text-sm text-stone-400">No checklist items yet.</p>}
        {items
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
              <button onClick={() => toggleDone(item)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    item.done ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400"
                  }`}
                >
                  <Check size={12} />
                </span>
                <span className={`text-xs font-bold truncate ${item.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{item.label}</span>
              </button>
              <button onClick={() => removeItem(item)} className="text-stone-300 hover:text-rose-500 shrink-0" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
      </div>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add a checklist item..."
          className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs"
        />
        <button
          onClick={addItem}
          disabled={adding || !newLabel.trim()}
          className="w-9 h-9 flex items-center justify-center bg-stone-900 text-white rounded-lg disabled:opacity-40 shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
