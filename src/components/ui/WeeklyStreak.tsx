"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export default function WeeklyStreak({ streakDays = [true, true, true, false, false, false, false] }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const currentStreak = streakDays.filter(Boolean).length;

  return (
    <div className="p-6 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-md">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-500/20 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <Flame size={24} fill="currentColor" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-tight">{currentStreak} Day Streak</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Consistency_Multiplier: 1.2x</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <motion.div 
              initial={false}
              animate={{ 
                scale: streakDays[i] ? 1 : 0.9,
                backgroundColor: streakDays[i] ? "rgba(249, 115, 22, 1)" : "rgba(255, 255, 255, 0.05)"
              }}
              className="w-10 h-12 rounded-xl flex items-center justify-center relative overflow-hidden"
            >
              {streakDays[i] && (
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-white/20"
                />
              )}
              <span className={`text-[10px] font-black ${streakDays[i] ? "text-white" : "text-slate-700"}`}>
                {day}
              </span>
            </motion.div>
            {/* Indicator Dot */}
            <div className={`w-1 h-1 rounded-full ${streakDays[i] ? "bg-orange-500" : "bg-transparent"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}