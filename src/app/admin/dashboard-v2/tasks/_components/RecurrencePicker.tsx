"use client";

import type { Recurrence } from "@/lib/dashboard-v2/taskRecurrence";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Simple presets only (daily/weekdays/weekly/monthly) - no RRULE/cron engine,
// per the scope boundary in the Projects+Tasks plan.
export function RecurrencePicker({ value, onChange }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void }) {
  const type = value?.type || "none";

  function setType(next: string) {
    if (next === "none") return onChange(null);
    if (next === "daily") return onChange({ type: "daily" });
    if (next === "weekdays") return onChange({ type: "weekdays", days: [1, 2, 3, 4, 5] });
    if (next === "weekly") return onChange({ type: "weekly", day: 1 });
    if (next === "monthly") return onChange({ type: "monthly", day_of_month: 1 });
  }

  return (
    <div className="space-y-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekdays">Specific weekdays</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>

      {value?.type === "weekdays" && (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((label, dow) => {
            const active = value.days.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() =>
                  onChange({ type: "weekdays", days: active ? value.days.filter((d) => d !== dow) : [...value.days, dow].sort() })
                }
                className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase ${active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400"}`}
              >
                {label[0]}
              </button>
            );
          })}
        </div>
      )}

      {value?.type === "weekly" && (
        <select
          value={value.day}
          onChange={(e) => onChange({ type: "weekly", day: Number(e.target.value) })}
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
        >
          {WEEKDAY_LABELS.map((label, dow) => (
            <option key={dow} value={dow}>
              Every {label}
            </option>
          ))}
        </select>
      )}

      {value?.type === "monthly" && (
        <input
          type="number"
          min={1}
          max={31}
          value={value.day_of_month}
          onChange={(e) => onChange({ type: "monthly", day_of_month: Number(e.target.value) })}
          placeholder="Day of month"
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
        />
      )}
    </div>
  );
}

export function recurrenceLabel(r: Recurrence | null): string | null {
  if (!r) return null;
  switch (r.type) {
    case "daily":
      return "Daily";
    case "weekdays":
      return r.days.map((d) => WEEKDAY_LABELS[d]).join("/");
    case "weekly":
      return `Weekly · ${WEEKDAY_LABELS[r.day]}`;
    case "monthly":
      return `Monthly · day ${r.day_of_month}`;
  }
}
