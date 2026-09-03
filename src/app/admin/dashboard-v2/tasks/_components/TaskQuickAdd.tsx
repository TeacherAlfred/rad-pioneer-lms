"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Recurrence } from "@/lib/dashboard-v2/taskRecurrence";
import { RecurrencePicker } from "./RecurrencePicker";
import type { TaskGroup } from "./GroupFilterBar";

export type NewTaskDraft = {
  title: string;
  due_date: string | null;
  recurrence: Recurrence | null;
  group_ids: string[];
  parent_task_id?: string;
};

export function TaskQuickAdd({
  groups,
  onAdd,
  placeholder = "Jot down a task...",
  compact = false,
}: {
  groups: TaskGroup[];
  onAdd: (draft: NewTaskDraft) => Promise<void>;
  placeholder?: string;
  compact?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({ title: title.trim(), due_date: dueDate || null, recurrence, group_ids: groupIds });
      setTitle("");
      setDueDate("");
      setRecurrence(null);
      setGroupIds([]);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "" : "bg-white border border-stone-200 rounded-[24px] shadow-sm p-2"}>
      <div className="flex gap-2 items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !expanded && submit()}
          placeholder={placeholder}
          className={`flex-1 bg-transparent focus:outline-none text-sm ${compact ? "px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg" : "px-4 py-2.5"}`}
        />
        {!compact && (
          <button onClick={() => setExpanded((v) => !v)} className="p-2 text-stone-400 hover:text-stone-900" title="More options">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 shrink-0"
        >
          <Plus size={13} />
          {!compact && "Add"}
        </button>
      </div>

      {expanded && (
        <div className="p-4 pt-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Repeats</label>
              <RecurrencePicker value={recurrence} onChange={setRecurrence} />
            </div>
          </div>
          {groups.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Groups</label>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const active = groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGroupIds((ids) => (active ? ids.filter((id) => id !== g.id) : [...ids, g.id]))}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        active ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 text-stone-500"
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
