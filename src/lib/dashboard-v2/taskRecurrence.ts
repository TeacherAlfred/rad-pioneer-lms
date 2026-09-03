import { periodRange, sastDateKey } from "./focusItemEvaluators";

// South Africa is UTC+2 year-round (no DST) - same fixed-offset reasoning as
// focusItemEvaluators.ts. Duplicated here (not imported) since it's a
// private implementation detail of the month-boundary helper below.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

export type Recurrence =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] } // 0=Sun..6=Sat
  | { type: "weekly"; day: number } // 0=Sun..6=Sat
  | { type: "monthly"; day_of_month: number };

export type RecurringTask = {
  id: string;
  due_date: string | null;
  recurrence: Recurrence | null;
  completed_at: string | null;
};

export type TaskCompletion = { task_id: string; completed_at: string };

function sastDow(now: Date): number {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  return sast.getUTCDay();
}

function sastDayOfMonth(now: Date): number {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  return sast.getUTCDate();
}

// [start, end) UTC instants bounding the current calendar month in SAST.
function monthPeriodRange(now: Date): { start: Date; end: Date } {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  const monthStartUTC = Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), 1);
  const nextMonthStartUTC = Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth() + 1, 1);
  return {
    start: new Date(monthStartUTC - SAST_OFFSET_MS),
    end: new Date(nextMonthStartUTC - SAST_OFFSET_MS),
  };
}

// The period a single occurrence's completion is tracked within. Daily and
// weekdays tasks are one-day periods (a new "today" each matching day);
// weekly/monthly tasks share the focus-item convention of a whole
// week/month being the one period, since they only come due once within it.
export function periodBoundsForRecurrence(recurrence: Recurrence, now: Date = new Date()): { start: Date; end: Date } {
  switch (recurrence.type) {
    case "daily":
    case "weekdays":
      return periodRange("daily", now);
    case "weekly":
      return periodRange("weekly", now);
    case "monthly":
      return monthPeriodRange(now);
  }
}

// Is `task` due today (SAST)? One-off tasks: due_date matches today exactly.
// Recurring tasks: today's SAST day-of-week/day-of-month matches the preset.
export function isDueToday(task: { due_date: string | null; recurrence: Recurrence | null }, now: Date = new Date()): boolean {
  if (!task.recurrence) {
    return task.due_date === sastDateKey(now);
  }
  switch (task.recurrence.type) {
    case "daily":
      return true;
    case "weekdays":
      return task.recurrence.days.includes(sastDow(now));
    case "weekly":
      return sastDow(now) === task.recurrence.day;
    case "monthly":
      return sastDayOfMonth(now) === task.recurrence.day_of_month;
  }
}

// One-off tasks only: due in the past and not completed.
export function isOverdue(task: { due_date: string | null; recurrence: Recurrence | null; completed_at: string | null }, now: Date = new Date()): boolean {
  if (task.recurrence || !task.due_date || task.completed_at) return false;
  return task.due_date < sastDateKey(now);
}

export function isCompletedForCurrentPeriod(task: RecurringTask, completions: TaskCompletion[], now: Date = new Date()): boolean {
  if (!task.recurrence) return !!task.completed_at;
  const { start, end } = periodBoundsForRecurrence(task.recurrence, now);
  return completions.some((c) => {
    if (c.task_id !== task.id) return false;
    const t = new Date(c.completed_at).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}
