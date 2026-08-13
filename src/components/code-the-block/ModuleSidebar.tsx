"use client";

import { motion } from "framer-motion";
import type { ModuleContent } from "@/lib/code-the-block/content/types";

function ProgressRing({ value, total }: { value: number; total: number }) {
  const size = 52;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : value / total;
  const offset = circumference * (1 - pct);
  const color = value === total ? "#88be56" : "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      className="pointer-events-none absolute inset-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        opacity={value === 0 ? 0.35 : 0.9}
      />
    </svg>
  );
}

export function ModuleSidebar({
  modules,
  activeId,
  onSelect,
  doneByModule,
}: {
  modules: ModuleContent[];
  activeId: string;
  onSelect: (id: string) => void;
  doneByModule: Record<string, number>;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-fit gap-2 rounded-2xl border border-white/10 bg-slate-900/85 p-2 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-1/2 lg:flex-col lg:-translate-y-1/2 lg:gap-3 lg:p-3">
      {modules.map((m) => {
        const active = m.id === activeId;
        const done = doneByModule[m.id] ?? 0;

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-label={m.title}
            className="group relative flex h-14 w-14 flex-none items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95"
          >
            {active && (
              <motion.div
                layoutId="ctb-module-active"
                className="absolute inset-0 rounded-xl bg-white/10 ring-2 ring-white/25"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              />
            )}
            <ProgressRing value={done} total={2} />
            <span className="relative text-2xl">{m.icon}</span>
            {done === 2 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rad-green text-[10px] font-bold text-slate-950 shadow">
                ✓
              </span>
            )}
            <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 lg:block">
              {m.title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
