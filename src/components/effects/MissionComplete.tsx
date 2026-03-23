"use client";

import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import { Trophy, Star, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

interface MissionCompleteProps {
  isOpen: boolean;
  missionName: string;
  xpAwarded: number;
  newTotalXp: number;
  starsEarned: number;
  nextLessonId?: string;
  onClose: () => void;
}

export default function MissionComplete({ 
  isOpen, 
  missionName, 
  xpAwarded, 
  newTotalXp, 
  starsEarned, 
  nextLessonId,
  onClose 
}: MissionCompleteProps) {

  useEffect(() => {
    if (isOpen) {
      const end = Date.now() + 3 * 1000;
      const colors = ["#3b82f6", "#2dd4bf", "#ffffff"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            className="max-w-xl w-full bg-white/5 border border-white/10 rounded-[48px] p-8 md:p-12 text-center relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/20 blur-[120px] rounded-full -z-10" />

            <div className="space-y-8">
              {/* Icon & XP Pop */}
              <div className="relative inline-block">
                <motion.div 
                  initial={{ rotate: -20, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
                >
                  <Trophy size={48} className="text-white" />
                </motion.div>
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: -40, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -top-4 -right-8 bg-yellow-500 text-slate-950 px-3 py-1 rounded-full font-black text-xs italic shadow-xl"
                >
                  +{xpAwarded} XP
                </motion.div>
              </div>

              {/* Text Content */}
              <div className="space-y-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Mission_Accomplished</h2>
                <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none italic uppercase">
                  {missionName}
                </h3>
              </div>

              {/* Stars Earned (Overdrive Visualization) */}
              <div className="flex justify-center gap-4">
                {[1, 2, 3].map((s) => (
                  <motion.div
                    key={s}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6 + s * 0.1, type: "spring" }}
                  >
                    <Star 
                      size={32} 
                      fill={s <= starsEarned ? "#eab308" : "transparent"} 
                      className={s <= starsEarned ? "text-yellow-500 drop-shadow-[0_0_10px_#eab308]" : "text-slate-800"} 
                    />
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4">
                <Link
                  href={nextLessonId ? `/student/lesson/${nextLessonId}` : "/"}
                  onClick={onClose}
                  className="group h-16 bg-white text-slate-950 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-transform active:scale-95"
                >
                  Continue to Next Mission
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <button 
                  onClick={onClose}
                  className="h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  Return to Mission Control
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}