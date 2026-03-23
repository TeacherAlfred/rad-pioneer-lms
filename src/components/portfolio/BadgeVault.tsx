"use client";

import { motion } from "framer-motion";
import { 
  Gamepad2, 
  MousePointer2, 
  Layers, 
  Bug, 
  Rocket,
  Star // Added for level indicators
} from "lucide-react";

const GAME_CREATOR_BADGES = [
  { 
    id: "sprite", 
    name: "Sprite Commander", 
    icon: <MousePointer2 />, 
    color: "text-[#d7a94a]", 
    bg: "bg-[#d7a94a]/10", 
    unlocked: true, 
    level: 3, // Level 1-3
    desc: "Mastered Asset Movement" 
  },
  { 
    id: "logic", 
    name: "Logic Overlord", 
    icon: <Gamepad2 />, 
    color: "text-[#d7a94a]", 
    bg: "bg-[#d7a94a]/10", 
    unlocked: true, 
    level: 1, 
    desc: "Variable & Loop Mastery" 
  },
  { id: "level", name: "Level Architect", icon: <Layers />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Environment Design" },
  { id: "bug", name: "Beta Tester", icon: <Bug />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Quality Control Protocol" },
  { id: "publish", name: "Global Publisher", icon: <Rocket />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Game Deployment Ready" },
];

export default function BadgeVault() {
  return (
    <section className="mt-16 relative">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-2 rounded-xl bg-[#d7a94a]/10 text-[#d7a94a]">
           <Gamepad2 size={18} />
        </div>
        <div className="flex flex-col">
           <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none">Specialization_Vault</h2>
           <p className="text-sm font-black italic uppercase text-white mt-1">Game_Creator_Bootcamp</p>
        </div>
        <div className="h-[1px] flex-1 bg-white/5 ml-4" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {GAME_CREATOR_BADGES.map((badge) => (
          <motion.div
            key={badge.id}
            whileHover={badge.unlocked ? { scale: 1.05, y: -5 } : {}}
            className={`relative p-8 rounded-[40px] border flex flex-col items-center text-center gap-4 transition-all ${
              badge.unlocked 
              ? "bg-white/5 border-white/10 shadow-2xl shadow-black" 
              : "bg-black/40 border-white/5 opacity-30 grayscale cursor-not-allowed"
            }`}
          >
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border border-white/5 ${badge.unlocked ? `${badge.bg} ${badge.color} shadow-[0_0_20px_rgba(215,169,74,0.15)]` : 'bg-white/5 text-slate-700'}`}>
              {badge.icon}
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase italic tracking-tighter text-white">{badge.name}</h4>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-tight px-2">{badge.desc}</p>
            </div>

            {badge.unlocked ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#88be56]/20 border border-[#88be56]/20">
                  <div className="w-1 h-1 rounded-full bg-[#88be56] shadow-[0_0_5px_#88be56]" />
                  <span className="text-[7px] font-black text-[#88be56] uppercase tracking-widest">Verified</span>
                </div>
                
                {/* LEVEL STARS INDICATOR */}
                <div className="flex gap-0.5">
                   {[...Array(3)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={10} 
                        className={i < badge.level ? "fill-[#d7a94a] text-[#d7a94a]" : "text-white/10"} 
                      />
                   ))}
                </div>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">
                   Level_0{badge.level}
                </span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-full bg-white/5 text-slate-700 text-[7px] font-black uppercase tracking-widest">Locked</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Mastery Progress Bar */}
      <div className="mt-12 p-8 rounded-[40px] bg-white/[0.02] border border-white/5">
         <div className="flex justify-between items-end mb-4">
            <div className="space-y-1">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bootcamp_Mastery_Sync</p>
               <p className="text-xl font-black italic uppercase text-white">2 / 5 Medals Secured</p>
            </div>
            <p className="text-[10px] font-black text-[#d7a94a] uppercase">Next: Level Architect</p>
         </div>
         <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
            <motion.div 
               initial={{ width: 0 }} 
               animate={{ width: "40%" }} 
               className="h-full bg-[#d7a94a] rounded-full shadow-[0_0_15px_rgba(215,169,74,0.4)]" 
            />
         </div>
      </div>
    </section>
  );
}