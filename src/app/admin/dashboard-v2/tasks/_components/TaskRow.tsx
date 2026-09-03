"use client";

import { Check, ChevronDown, ChevronRight, Trash2, Repeat, CalendarClock } from "lucide-react";
import { recurrenceLabel } from "./RecurrencePicker";
import type { Recurrence } from "@/lib/dashboard-v2/taskRecurrence";
import type { TaskGroup } from "./GroupFilterBar";

export type TaskRowData = {
  id: string;
  title: string;
  due_date: string | null;
  recurrence: Recurrence | null;
  completed_at: string | null;
  due_today: boolean;
  overdue: boolean;
  completed_for_period: boolean;
  group_ids: string[];
};

function isDone(task: TaskRowData): boolean {
  return task.recurrence ? task.completed_for_period : !!task.completed_at;
}

export function TaskRow({
  task,
  groups,
  subtasks,
  expanded,
  onToggleExpand,
  onToggleComplete,
  onDelete,
}: {
  task: TaskRowData;
  groups: TaskGroup[];
  subtasks?: TaskRowData[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  onToggleComplete: (task: TaskRowData) => void;
  onDelete: (task: TaskRowData) => void;
}) {
  const done = isDone(task);
  const recurLabel = recurrenceLabel(task.recurrence);
  const taskGroups = groups.filter((g) => task.group_ids.includes(g.id));

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <div className="flex items-center gap-3 py-3 px-1">
        {subtasks && subtasks.length > 0 ? (
          <button onClick={onToggleExpand} className="text-stone-300 hover:text-stone-600 shrink-0">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <button
          onClick={() => onToggleComplete(task)}
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            done ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400 hover:bg-stone-300"
          }`}
        >
          <Check size={12} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${done ? "text-stone-400 line-through" : "text-stone-800"}`}>{task.title}</p>
          {(taskGroups.length > 0 || recurLabel || task.due_date) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {recurLabel && (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  <Repeat size={9} /> {recurLabel}
                </span>
              )}
              {!task.recurrence && task.due_date && (
                <span
                  className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                    task.overdue ? "text-rose-700 bg-rose-50" : "text-stone-500 bg-stone-100"
                  }`}
                >
                  <CalendarClock size={9} /> {task.due_date}
                </span>
              )}
              {taskGroups.map((g) => (
                <span key={g.id} className="text-[9px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => onDelete(task)} className="p-1.5 text-stone-300 hover:text-rose-500 shrink-0" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && subtasks && subtasks.length > 0 && (
        <div className="pl-8 pb-2 space-y-0.5">
          {subtasks.map((st) => {
            const stDone = isDone(st);
            return (
              <div key={st.id} className="flex items-center gap-3 py-1.5">
                <button
                  onClick={() => onToggleComplete(st)}
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    stDone ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400 hover:bg-stone-300"
                  }`}
                >
                  <Check size={10} />
                </button>
                <p className={`text-xs font-bold truncate flex-1 ${stDone ? "text-stone-400 line-through" : "text-stone-700"}`}>{st.title}</p>
                <button onClick={() => onDelete(st)} className="p-1 text-stone-300 hover:text-rose-500 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
