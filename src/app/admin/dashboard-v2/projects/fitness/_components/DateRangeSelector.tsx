"use client";

import { RANGE_OPTIONS, type RangeKey } from "@/lib/fitness/dateRange";

export function DateRangeSelector({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <div className="inline-flex bg-stone-100 rounded-full p-1 gap-1">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
            value === opt.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
