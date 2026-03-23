"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Share2, Home, Zap } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";

export default function MissionCompletePage() {
  
  // Trigger branded confetti on mount
  useEffect(() => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#5574a9", "#45a79a", "#88be56"], // RAD Official Palette
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#5574a9", "#45a79a", "#88be56"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <main className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Brand Device */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,#5d438515_0%,transparent_70%)]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white/5 border border-white/10 rounded-[48px] p-10 md:p-16 text-center relative z-10 backdrop-blur-xl"
      >
        <motion.div 
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="w-24 h-24 bg-[#88be56] rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(136,190,86,0.4)]"
        >
          <Trophy size={48} className="text-white" />
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
          Mission <span className="text-[#88be56]">Accomplished</span>
        </h1>
        <p className="text-[#45a79a] font-bold tracking-[0.3em] uppercase text-xs mb-12">
          Uplink Synchronization Successful
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">XP_Gained</p>
            <p className="text-4xl font-black text-[#d7a94a] italic">+250</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">New_Rank</p>
            <p className="text-4xl font-black text-white italic tracking-tighter">TECH II</p>
          </div>
        </div>

        <div className="space-y-4">
          <Link 
            href="/"
            className="w-full h-20 rounded-[28px] bg-white text-[#020617] flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Return to Mission Control <Home size={18} />
          </Link>
          
          <div className="flex gap-4">
            <button className="flex-1 h-16 rounded-[24px] bg-white/5 border border-white/10 text-white flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
              <Share2 size={14} /> Share Status
            </button>
            <button className="flex-1 h-16 rounded-[24px] bg-[#5574a9]/20 border border-[#5574a9]/30 text-[#5574a9] flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] hover:bg-[#5574a9]/30 transition-all">
              <Zap size={14} /> View Blueprint
            </button>
          </div>
        </div>
        
      </motion.div>
    </main>
  );
}