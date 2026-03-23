"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMission } from "@/context/MissionContext";

export default function PioneerProgressBar() {
  const { stats, pendingXp } = useMission();
  
  const floor = stats.currentLevel.xpRequired;
  const ceiling = stats.nextLevel?.xpRequired || (floor + 1000);
  const progress = ((stats.xp - floor) / (ceiling - floor)) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-end px-1">
        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
          Rank: <span style={{ color: stats.currentLevel.accentColor }}>{stats.currentLevel.name}</span>
        </span>
        <span className="text-[10px] font-black text-white italic">
          {stats.xp} <span className="opacity-30">/ {ceiling} XP</span>
        </span>
      </div>

      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
        {/* The Actual Progress Fill */}
        <motion.div
          initial={false}
          animate={{ width: `${Math.min(100, progress)}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
          className="h-full relative shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          style={{ backgroundColor: stats.currentLevel.accentColor }}
        >
          {/* Animated "Pulse" overlay when points are added */}
          <AnimatePresence>
            {pendingXp && (
              <motion.div
                initial={{ opacity: 0, x: "-100%" }}
                animate={{ opacity: [0, 1, 0], x: "100%" }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 bg-white/40"
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}