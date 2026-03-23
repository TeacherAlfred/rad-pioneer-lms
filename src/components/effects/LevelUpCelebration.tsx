"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useMission } from "@/context/MissionContext";
import { Trophy, Star, ArrowRight } from "lucide-react";

export default function LevelUpCelebration() {
  const { stats, showLevelUp, setShowLevelUp } = useMission();

  useEffect(() => {
    if (showLevelUp) {
      // Trigger multiple bursts of confetti
      const radColors = ["#5574a9", "#45a79a", "#88be56"];
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: radColors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: radColors
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [showLevelUp, stats.currentLevel.accentColor]);

  return (
    <AnimatePresence>
      {showLevelUp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative max-w-sm w-full p-8 text-center"
          >
            {/* The Badge Glow */}
            <div 
              className="absolute inset-0 blur-[100px] opacity-20 rounded-full"
              style={{ backgroundColor: stats.currentLevel.accentColor }}
            />

            <div className="relative space-y-6">
              <div className="flex justify-center">
                <div 
                  className="p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl"
                  style={{ borderColor: `${stats.currentLevel.accentColor}33` }}
                >
                  <Trophy 
                    size={64} 
                    style={{ color: stats.currentLevel.accentColor }} 
                    className="drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl font-black tracking-tighter text-white uppercase"
                >
                  Rank Up!
                </motion.h2>
                <p className="text-slate-400 font-medium">
                  You are now officially a
                </p>
                <motion.div 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="inline-block px-4 py-1 rounded-full text-sm font-black tracking-widest uppercase"
                  style={{ backgroundColor: `${stats.currentLevel.accentColor}22`, color: stats.currentLevel.accentColor }}
                >
                  {stats.currentLevel.name}
                </motion.div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setShowLevelUp(false)}
                  className="group relative w-full h-14 bg-white text-slate-950 rounded-2xl font-black text-sm tracking-widest uppercase transition-transform active:scale-95 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Continue Mission <ArrowRight size={16} />
                  </span>
                  <motion.div 
                    className="absolute inset-0 bg-slate-200"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ type: "tween" }}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}