"use client";

import { TaskQuickAdd, NewTaskDraft } from "./TaskQuickAdd";
import type { TaskGroup } from "./GroupFilterBar";

// Renders just the "add a subtask" affordance under an expanded TaskRow -
// the subtask rows themselves are rendered inline by TaskRow since they
// share its compact row layout.
export function SubtaskList({ parentId, onAdd }: { parentId: string; onAdd: (draft: NewTaskDraft) => Promise<void> }) {
  return (
    <div className="pl-8 pb-3">
      <TaskQuickAdd groups={[] as TaskGroup[]} placeholder="Add a subtask..." compact onAdd={(draft) => onAdd({ ...draft, parent_task_id: parentId })} />
    </div>
  );
}
