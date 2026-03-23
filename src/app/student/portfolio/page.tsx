"use client";

import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  ExternalLink, 
  Code2, 
  Palette, 
  Gamepad2,
  MousePointer2,
  Layers,
  Bug,
  Rocket,
  Star
} from "lucide-react";
import Link from "next/link";

// 1. Updated Badge Data with 3-Star Leveling
const GAME_CREATOR_BADGES = [
  { 
    id: "sprite", 
    name: "Sprite Commander", 
    icon: <MousePointer2 size={24} />, 
    color: "text-[#d7a94a]", 
    bg: "bg-[#d7a94a]/10", 
    unlocked: true, 
    level: 3, 
    desc: "Mastered Asset Movement" 
  },
  { 
    id: "logic", 
    name: "Logic Overlord", 
    icon: <Gamepad2 size={24} />, 
    color: "text-[#d7a94a]", 
    bg: "bg-[#d7a94a]/10", 
    unlocked: true, 
    level: 1, 
    desc: "Variable & Loop Mastery" 
  },
  { id: "level", name: "Level Architect", icon: <Layers size={24} />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Environment Design" },
  { id: "bug", name: "Beta Tester", icon: <Bug size={24} />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Quality Control Protocol" },
  { id: "publish", name: "Global Publisher", icon: <Rocket size={24} />, color: "text-slate-500", bg: "bg-white/5", unlocked: false, level: 0, desc: "Game Deployment Ready" },
];

export default function PortfolioPage() {
  const formatXP = (num: number) => new Intl.NumberFormat('en-US').format(num);

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans pb-24 relative overflow-hidden">
      {/* Background Energy */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#d7a94a]/5 blur-[120px] rounded-full pointer-events-none" />

      <section className="relative pt-20 px-8 max-w-7xl mx-auto z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-16 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Return_to_Control</span>
        </Link>

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-12 items-end justify-between mb-24">
          <div className="space-y-6">
            <h1 className="text-8xl md:text-[120px] font-black uppercase italic tracking-tighter leading-[0.8]">
              Pioneer_ <br /><span className="text-[#d7a94a]">Showcase</span>
            </h1>
            <p className="text-xl text-slate-400 font-medium italic tracking-tight">Jane_Doe // Game_Creator_v1.0</p>
          </div>
          
          <div className="p-10 rounded-[48px] bg-white/5 border border-white/10 text-center min-w-[200px] backdrop-blur-md shadow-2xl">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Sync_Level</p>
            <p suppressHydrationWarning className="text-6xl font-black italic tracking-tighter text-[#d7a94a]">
              {formatXP(2450)}
            </p>
          </div>
        </div>

        {/* 2. ACHIEVEMENT VAULT SECTION */}
        <section className="mt-16 relative">
          <div className="flex items-center gap-4 mb-12">
            <div className="p-2.5 rounded-xl bg-[#d7a94a]/10 text-[#d7a94a] border border-[#d7a94a]/20">
               <Gamepad2 size={20} />
            </div>
            <div className="flex flex-col">
               <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none">Specialization_Vault</h2>
               <p className="text-lg font-black italic uppercase text-white mt-1">Game_Creator_Bootcamp</p>
            </div>
            <div className="h-[1px] flex-1 bg-white/5 ml-4" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {GAME_CREATOR_BADGES.map((badge) => (
              <motion.div
                key={badge.id}
                whileHover={badge.unlocked ? { scale: 1.05, y: -8 } : {}}
                className={`relative p-10 rounded-[56px] border flex flex-col items-center text-center gap-6 transition-all ${
                  badge.unlocked 
                  ? "bg-white/[0.03] border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
                  : "bg-black/40 border-white/5 opacity-20 grayscale cursor-not-allowed"
                }`}
              >
                <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center border border-white/5 ${badge.unlocked ? `${badge.bg} ${badge.color} shadow-[0_0_30px_rgba(215,169,74,0.2)]` : 'bg-white/5 text-slate-700'}`}>
                  {badge.icon}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-black uppercase italic tracking-tighter text-white">{badge.name}</h4>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight px-4">{badge.desc}</p>
                </div>

                {badge.unlocked ? (
                  <div className="flex flex-col items-center gap-3 mt-2">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#88be56]/10 border border-[#88be56]/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#88be56] shadow-[0_0_8px_#88be56]" />
                      <span className="text-[8px] font-black text-[#88be56] uppercase tracking-[0.2em]">Verified</span>
                    </div>
                    
                    {/* 3-STAR LEVEL INDICATOR */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={12} 
                            className={i < badge.level ? "fill-[#d7a94a] text-[#d7a94a] drop-shadow-[0_0_5px_rgba(215,169,74,0.5)]" : "text-white/5"} 
                          />
                        ))}
                      </div>
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">Level_0{badge.level}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 px-4 py-1.5 rounded-full bg-white/5 text-slate-700 text-[8px] font-black uppercase tracking-widest border border-white/5">Locked</div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Mastery Sync Bar */}
          <div className="mt-16 p-10 rounded-[56px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
             <div className="flex justify-between items-end mb-6 px-2">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Bootcamp_Mastery_Sync</p>
                   <p className="text-2xl font-black italic uppercase text-white tracking-tighter">2 / 5 Medals Secured</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-[#d7a94a] uppercase tracking-widest mb-1">Target_Unlock</p>
                   <p className="text-sm font-bold text-slate-400 uppercase italic">Level Architect</p>
                </div>
             </div>
             <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden p-1 border border-white/5">
                <motion.div 
                   initial={{ width: 0 }} 
                   animate={{ width: "40%" }} 
                   className="h-full bg-[#d7a94a] rounded-full shadow-[0_0_20px_rgba(215,169,74,0.3)] relative"
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 blur-[2px]" />
                </motion.div>
             </div>
          </div>
        </section>

        {/* Projects Section Placeholder */}
        <section className="mt-32 pb-20">
          <div className="flex items-center justify-between mb-16">
            <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-[#45a79a]">Verified_Deployments</h2>
            <div className="h-[1px] flex-1 bg-white/5 mx-10" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 opacity-50 italic text-slate-600 text-sm">
             {/* Project cards go here */}
             [System_Standby: Awaiting_Project_Data]
          </div>
        </section>
      </section>
    </main>
  );
}