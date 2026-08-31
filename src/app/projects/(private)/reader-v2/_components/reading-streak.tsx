"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface ReadingStreakProps {
  /** YYYY-MM-DD dates (any day at least one book's last_read_at fell on) */
  activeDates: Set<string>;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
const CELEBRATED_KEY = "meridian:lastCelebratedStreak";

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

  const [showFlourish, setShowFlourish] = useState(false);

  useEffect(() => {
    if (!MILESTONES.includes(streak)) return;
    const lastCelebrated = Number(localStorage.getItem(CELEBRATED_KEY) || 0);
    if (streak > lastCelebrated) {
      setShowFlourish(true);
      localStorage.setItem(CELEBRATED_KEY, String(streak));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  if (streak === 0 && days.every((d) => !d.active)) return null;

  return (
    <div className="relative flex items-center gap-3 bg-white border border-slate-200 rounded-[16px] pl-3 pr-4 py-2 shadow-sm overflow-visible">
      <AnimatePresence>
        {showFlourish && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1.3, 1.5] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, times: [0, 0.25, 0.7, 1], ease: "easeOut" }}
            onAnimationComplete={() => setShowFlourish(false)}
            className="absolute -inset-2 rounded-[20px] pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(199,154,75,0.35) 0%, transparent 70%)",
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={streak >= 3 ? { scale: [1, 1.08, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
          streak >= 3
            ? "bg-brass-100 border-brass-400 text-brass-600 shadow-[0_0_16px_rgba(199,154,75,0.35)]"
            : "bg-slate-100 border-slate-200 text-slate-400"
        }`}
      >
        <Flame size={16} fill="currentColor" />
      </motion.div>

      <div className="relative">
        <p className="font-display italic text-lg text-slate-900 leading-none">
          {streak} day{streak === 1 ? "" : "s"}
        </p>
        <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest mt-1">Reading streak</p>
      </div>

      <div className="hidden md:flex items-center gap-1 ml-2 pl-4 border-l border-slate-100 relative">
        {days.map((d, i) => (
          <div
            key={i}
            title={d.label}
            className={`w-3.5 h-3.5 rounded-full ${d.active ? "bg-brass-500" : "bg-slate-100"}`}
          />
        ))}
      </div>
    </div>
  );
}
