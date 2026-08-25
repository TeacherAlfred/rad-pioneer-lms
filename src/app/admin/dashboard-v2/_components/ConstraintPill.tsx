"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSTRAINT_COPY: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  lead_volume: { label: "Lead Volume", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
  founder_attention: { label: "Founder Attention", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
};

// Compact echo of Home's full Constraint Banner (page.tsx) - addendum A1.2
// calls for a persistent constraint indicator on every screen, but only Home
// has room for the full version, so this is the minimal form for the other 4.
export function ConstraintPill() {
  const [state, setState] = useState<{ state: string; reason: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/admin/api/dashboard-v2/summary");
        const data = await res.json();
        if (res.ok) setState(data.constraint);
      } catch {
        // Silent - this is a secondary indicator; Home remains the source of truth.
      }
    })();
  }, []);

  if (!state) return null;
  const copy = CONSTRAINT_COPY[state.state];
  if (!copy) return null;

  return (
    <Link
      href="/admin/dashboard-v2"
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs mb-3 w-fit hover:opacity-80 transition-opacity ${copy.bg} ${copy.border} ${copy.color}`}
    >
      <span className={`w-2 h-2 rounded-full ${copy.dot}`} />
      <span className="font-black uppercase tracking-widest text-[10px]">{copy.label}</span>
      <span className="text-stone-400">·</span>
      <span className="text-stone-600">{state.reason}</span>
    </Link>
  );
}
