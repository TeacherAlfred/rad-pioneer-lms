"use client";

import { motion } from "framer-motion";

interface XPBarProps {
  xp?: number;
  floor?: number;
  ceiling?: number;
  accentColor?: string;
  rankName?: string;
}

export default function PioneerXPBar({ 
  xp = 0, 
  floor = 0, 
  ceiling = 1000, 
  accentColor = "#5574a9",
  rankName = "Technician" 
}: XPBarProps) {
  
  const range = ceiling - floor;
  const progressWithinLevel = xp - floor;
  const progressPercentage = Math.max(0, Math.min(100, (progressWithinLevel / range) * 100));
  
  // Calculate points remaining for a more "active" footer message
  const pointsNeeded = Math.max(0, ceiling - xp);

  return (
    <div className="w-full space-y-4">
      {/* 1. Header Labels (Kept as is per your request) */}
      <div className="flex justify-between items-end px-1">
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
            Your Rank
          </span>
          <span className="text-xl font-black italic uppercase text-white tracking-tight">
            {rankName}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-black text-white/70 block uppercase tracking-widest">
            Points
          </span>
          <span className="text-lg font-black text-white italic">
            {xp} <span className="text-xs text-white/50">XP</span>
          </span>
        </div>
      </div>

      {/* 2. The Progress Bar */}
      <div className="relative h-5 w-full bg-black/60 rounded-full overflow-hidden border border-white/20 p-[3px] shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          className="h-full rounded-full relative overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          style={{ backgroundColor: accentColor }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </div>

      {/* 3. Improved Footer: High Visibility & Simple Language */}
      <div className="flex justify-between items-center px-1">
        {/* Replaced 'Floor' with 'Level Start' and boosted contrast to white/90 */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-[11px] font-black text-white uppercase tracking-wider">
            Level Start: {floor}
          </span>
        </div>

        {/* Replaced 'Next Level' with a 'Points Left' call to action */}
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-black text-white uppercase tracking-tight">
            {pointsNeeded} XP to Next Rank
          </span>
        </div>
      </div>
    </div>
  );
}