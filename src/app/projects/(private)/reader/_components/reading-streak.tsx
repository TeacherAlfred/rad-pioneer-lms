"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface ReadingStreakProps {
  /** YYYY-MM-DD dates (any day at least one book's last_read_at fell on) */
  activeDates: Set<string>;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ReadingStreak({ activeDates }: ReadingStreakProps) {
  const today = new Date();

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { label: DAY_LABELS[d.getDay()], active: activeDates.has(dateKey(d)) };
  });

  let streak = 0;
  const cursor = new Date(today);
  if (!activeDates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  if (streak === 0 && days.every((d) => !d.active)) return null;

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-[16px] pl-3 pr-4 py-2 shadow-sm">
      <motion.div
        animate={streak >= 3 ? { scale: [1, 1.08, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
          streak >= 3
            ? "bg-amber-100 border-amber-300 text-amber-600 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
            : "bg-slate-100 border-slate-200 text-slate-400"
        }`}
      >
        <Flame size={16} fill="currentColor" />
      </motion.div>

      <div>
        <p className="text-sm font-black text-slate-900 leading-none">
          {streak} day{streak === 1 ? "" : "s"}
        </p>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Reading streak</p>
      </div>

      <div className="hidden md:flex items-center gap-1 ml-2 pl-4 border-l border-slate-100">
        {days.map((d, i) => (
          <div
            key={i}
            title={d.label}
            className={`w-3.5 h-3.5 rounded-full ${d.active ? "bg-amber-500" : "bg-slate-100"}`}
          />
        ))}
      </div>
    </div>
  );
}
