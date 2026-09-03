"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Settings2, Eye, EyeOff } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { TaskQuickAdd, NewTaskDraft } from "./_components/TaskQuickAdd";
import { GroupFilterBar, TaskGroup } from "./_components/GroupFilterBar";
import { TaskRow, TaskRowData } from "./_components/TaskRow";
import { SubtaskList } from "./_components/SubtaskList";

type Task = TaskRowData & { parent_task_id: string | null };

function isDone(task: TaskRowData): boolean {
  return task.recurrence ? task.completed_for_period : !!task.completed_at;
}

// God Mode: the founder's first-thing-every-morning check-in - every task
// in one flat list regardless of grouping, so nothing noted days or weeks
// ago gets lost across pages.
export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  async function load() {
    const [tasksRes, groupsRes] = await Promise.all([
      fetch("/admin/api/dashboard-v2/tasks").then((r) => r.json()),
      fetch("/admin/api/dashboard-v2/tasks/groups").then((r) => r.json()),
    ]);
    setTasks(tasksRes.tasks || []);
    setGroups(groupsRes.groups || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTask(draft: NewTaskDraft) {
    await fetch("/admin/api/dashboard-v2/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    await load();
  }

  async function addSubtask(draft: NewTaskDraft) {
    await addTask(draft);
    if (draft.parent_task_id) setExpanded((s) => new Set(s).add(draft.parent_task_id!));
  }

  async function toggleComplete(task: TaskRowData) {
    const url = `/admin/api/dashboard-v2/tasks/${task.id}/complete`;
    await fetch(url, { method: isDone(task) ? "DELETE" : "POST" });
    await load();
  }

  async function deleteTask(task: TaskRowData) {
    await fetch(`/admin/api/dashboard-v2/tasks/${task.id}`, { method: "DELETE" });
    await load();
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { overdue, dueToday, upcoming, completed, subtasksByParent } = useMemo(() => {
    const subtasksByParent = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_task_id) {
        const list = subtasksByParent.get(t.parent_task_id) || [];
        list.push(t);
        subtasksByParent.set(t.parent_task_id, list);
      }
    }

    let topLevel = tasks.filter((t) => !t.parent_task_id);
    if (selectedGroups.length > 0) {
      topLevel = topLevel.filter((t) => t.group_ids.some((g) => selectedGroups.includes(g)));
    }

    const overdue = topLevel.filter((t) => !isDone(t) && t.overdue);
    const dueToday = topLevel.filter((t) => !isDone(t) && !t.overdue && t.due_today);
    const upcoming = topLevel.filter((t) => !isDone(t) && !t.overdue && !t.due_today);
    const completed = topLevel.filter((t) => isDone(t));

    return { overdue, dueToday, upcoming, completed, subtasksByParent };
  }, [tasks, selectedGroups]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  const sections: { title: string; items: Task[]; tint?: string }[] = [
    { title: "Overdue", items: overdue, tint: "text-rose-600" },
    { title: "Due Today", items: dueToday, tint: "text-amber-600" },
    { title: "Everything Else", items: upcoming },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <DashboardV2Nav />

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Tasks</h1>
            <p className="text-stone-500 text-sm mt-1">Every task, one list. Nothing gets lost.</p>
          </div>
          <Link
            href="/admin/dashboard-v2/tasks/groups"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 shrink-0"
          >
            <Settings2 size={13} />
            Groups
          </Link>
        </header>

        <TaskQuickAdd groups={groups} onAdd={addTask} />

        <GroupFilterBar
          groups={groups}
          selected={selectedGroups}
          onToggle={(id) => setSelectedGroups((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))}
          onClear={() => setSelectedGroups([])}
        />

        {sections.map((section) => (
          <section key={section.title}>
            {section.items.length > 0 && (
              <>
                <h2 className={`text-[11px] font-black uppercase tracking-widest mb-2 ${section.tint || "text-stone-400"}`}>
                  {section.title} · {section.items.length}
                </h2>
                <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm px-4">
                  {section.items.map((task) => (
                    <div key={task.id}>
                      <TaskRow
                        task={task}
                        groups={groups}
                        subtasks={subtasksByParent.get(task.id)}
                        expanded={expanded.has(task.id)}
                        onToggleExpand={() => toggleExpand(task.id)}
                        onToggleComplete={toggleComplete}
                        onDelete={deleteTask}
                      />
                      {expanded.has(task.id) && <SubtaskList parentId={task.id} onAdd={addSubtask} />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ))}

        {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 && (
          <p className="text-sm text-stone-400 px-2">Nothing open — add a task above.</p>
        )}

        {completed.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-2"
            >
              {showCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
              {showCompleted ? "Hide" : "Show"} Completed · {completed.length}
            </button>
            {showCompleted && (
              <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm px-4 opacity-70">
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    groups={groups}
                    subtasks={subtasksByParent.get(task.id)}
                    onToggleComplete={toggleComplete}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
