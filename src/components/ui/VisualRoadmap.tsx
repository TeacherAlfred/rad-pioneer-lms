"use client";

import { motion } from "framer-motion";
import { Check, Lock, Play, Star } from "lucide-react";

interface Mission {
  id: number;
  title: string;
  status: "completed" | "current" | "locked";
}

export default function VisualRoadmap({ missions }: { missions: Mission[] }) {
  return (
    <div className="py-12 px-4 overflow-x-auto">
      <div className="flex items-center gap-4 min-w-max">
        {missions.map((mission, i) => (
          <div key={mission.id} className="flex items-center">
            {/* Mission Node */}
            <div className="relative flex flex-col items-center group">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className={`w-20 h-20 rounded-[24px] flex items-center justify-center border-2 transition-all duration-500 shadow-2xl ${
                  mission.status === "completed" 
                    ? "bg-green-500/20 border-green-500/50 text-green-400" 
                    : mission.status === "current"
                    ? "bg-blue-600 border-white shadow-[0_0_30px_rgba(37,99,235,0.6)] text-white"
                    : "bg-slate-900 border-white/10 text-slate-700"
                }`}
              >
                {mission.status === "completed" && <Check size={32} strokeWidth={3} />}
                {mission.status === "current" && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                  >
                    <Star size={32} fill="currentColor" />
                  </motion.div>
                )}
                {mission.status === "locked" && <Lock size={28} />}
              </motion.div>

              {/* Label */}
              <div className="mt-4 text-center">
                <p className={`text-[10px] font-black uppercase tracking-widest ${
                  mission.status === "locked" ? "text-slate-700" : "text-slate-400"
                }`}>
                  Mission_{i + 1}
                </p>
                <p className={`text-xs font-bold max-w-[100px] leading-tight mt-1 ${
                  mission.status === "locked" ? "text-slate-800" : "text-white"
                }`}>
                  {mission.title}
                </p>
              </div>

              {/* Current Indicator Glow */}
              {mission.status === "current" && (
                <motion.div
                  layoutId="activeGlow"
                  className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full -z-10"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </div>

            {/* Connecting Path/Line */}
            {i < missions.length - 1 && (
              <div className="w-16 h-[2px] bg-slate-800 relative mx-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: mission.status === "completed" ? "100%" : "0%" }}
                  className="absolute inset-0 bg-green-500/50"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}