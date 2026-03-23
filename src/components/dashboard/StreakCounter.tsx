"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Timer, AlertTriangle } from "lucide-react";

interface StreakProps {
  currentStreak: number;
  lastActive: string; // e.g., "2026-03-21"
}

export default function StreakCounter({ currentStreak = 3 }: StreakProps) {
  // Mocking a 7-day week status
  const weekProgress = [true, true, true, false, false, false, false]; 
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <section className="relative overflow-hidden p-8 rounded-[40px] bg-white/[0.03] border border-white/10 backdrop-blur-md">
      {/* Background Energy Glow */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[80px] opacity-20 transition-colors ${currentStreak >= 5 ? 'bg-[#88be56]' : 'bg-[#5574a9]'}`} />

      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        
        {/* Left: The Big Number */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <motion.div 
              animate={currentStreak >= 5 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-20 h-20 rounded-[24px] flex items-center justify-center border-2 transition-all ${
                currentStreak >= 5 
                ? "bg-[#88be56]/20 border-[#88be56] text-[#88be56] shadow-[0_0_30px_rgba(136,190,86,0.3)]" 
                : "bg-[#5574a9]/20 border-[#5574a9] text-[#5574a9]"
              }`}
            >
              <Zap size={32} fill="currentColor" />
            </motion.div>
            {/* Multiplier Tag */}
            {currentStreak >= 5 && (
              <div className="absolute -top-2 -right-2 bg-[#88be56] text-[#020617] text-[10px] font-black px-2 py-0.5 rounded-full uppercase italic">
                x2 XP
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              {currentStreak} Day <span className={currentStreak >= 5 ? "text-[#88be56]" : "text-[#5574a9]"}>Sync</span>
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Uplink_Stability: {currentStreak >= 5 ? 'Overdrive' : 'Optimal'}</p>
          </div>
        </div>

        {/* Right: The 7-Day Tracker */}
        <div className="flex gap-3">
          {weekProgress.map((active, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-12 rounded-xl border flex items-center justify-center transition-all ${
                  active 
                  ? "bg-white/10 border-[#5574a9] text-[#5574a9] shadow-[0_0_10px_rgba(85,116,169,0.2)]" 
                  : "bg-black/40 border-white/5 text-slate-700"
                }`}
              >
                {active ? <ShieldCheck size={16} /> : <Timer size={16} />}
              </div>
              <span className={`text-[9px] font-black ${active ? 'text-white' : 'text-slate-600'}`}>{days[i]}</span>
            </div>
          ))}
        </div>

      </div>

      {/* Warning/Motivation Banner */}
      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          <AlertTriangle size={12} className="text-[#d7a94a]" />
          <span>Sync expires in: <span className="text-white">06:42:10</span></span>
        </div>
        <p className="text-[9px] font-black italic text-[#5574a9] uppercase tracking-tighter">
          Next_Reward: +50 Bonus XP
        </p>
      </div>
    </section>
  );
}