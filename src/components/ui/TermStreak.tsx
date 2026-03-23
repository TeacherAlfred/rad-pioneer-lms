"use client";

import { motion } from "framer-motion";
import { Star, Zap, CheckCircle2 } from "lucide-react";

interface WeekStatus {
  weekNumber: number;
  attended: boolean; // Weekly Lesson
  lmsDays: number;   // 0, 1, or 2 extra days
  isCurrent: boolean;
}

export default function TermStreak({ termData }: { termData: WeekStatus[] }) {
  return (
    <div className="p-6 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-md w-full">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-yellow-500/20 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-none uppercase italic">Term Progress</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">12 Week Mastery Journey</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white italic">Week {termData.find(w => w.isCurrent)?.weekNumber || 1}</span>
        </div>
      </div>

      {/* 12-Week Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
        {termData.map((week) => {
          const isComplete = week.attended;
          const overdriveLevel = week.lmsDays; // 0, 1, or 2

          return (
            <div key={week.weekNumber} className="flex flex-col items-center gap-2">
              <motion.div
                whileHover={{ y: -5 }}
                className={`w-full aspect-[3/4] rounded-2xl flex flex-col items-center justify-center relative border transition-all duration-500 ${
                  week.isCurrent 
                    ? "bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
                    : isComplete 
                    ? "bg-white/10 border-white/20" 
                    : "bg-white/5 border-white/5 opacity-40"
                }`}
              >
                <span className={`text-[10px] font-black mb-1 ${week.isCurrent ? "text-white" : "text-slate-500"}`}>
                  W{week.weekNumber}
                </span>
                
                {isComplete ? (
                  <CheckCircle2 size={18} className={week.isCurrent ? "text-white" : "text-blue-400"} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-700" />
                )}

                {/* Overdrive Stars */}
                <div className="absolute -bottom-1 flex gap-0.5">
                  {[1, 2].map((star) => (
                    <motion.div
                      key={star}
                      initial={false}
                      animate={{ 
                        scale: overdriveLevel >= star ? 1 : 0.8,
                        opacity: overdriveLevel >= star ? 1 : 0
                      }}
                    >
                      <Star 
                        size={10} 
                        fill="#eab308" 
                        className="text-yellow-500 drop-shadow-[0_0_5px_#eab308]" 
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}