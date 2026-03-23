"use client";

import { useEffect, useState } from "react";
import { 
  Shield, 
  Award, 
  Box, 
  Zap, 
  Settings, 
  Share2, 
  LayoutDashboard, 
  Trophy,
  LogOut,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProfileSidebar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([]);

  // 1. Fetch real-time session and inventory from Database
  useEffect(() => {
    async function syncSidebarData() {
      if (typeof window !== "undefined") {
        const sessionData = localStorage.getItem("pioneer_session");
        if (!sessionData) return;
        
        const localUser = JSON.parse(sessionData);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, inventory')
          .eq('id', localUser.id)
          .single();

        if (!error && profile) {
          setUser(profile);
          setUnlockedItems(profile.inventory || []);
        }
      }
    }
    syncSidebarData();
  }, []);

  // Defined Toolset - These IDs must match what you store in the DB array
  const toolDefinitions = [
    { id: "redstone", name: "Redstone Wire" },
    { id: "logic_gates", name: "Logic Kit" },
    { id: "command_blocks", name: "Command Block" },
    { id: "python", name: "Python Script" },
  ];

  const handleShare = () => {
    const url = `${window.location.origin}/student/portfolio/${user?.id || ''}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem("pioneer_session");
    router.push("/");
  };

  if (!user) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-80 bg-[#020617] border-l border-white/5 p-8 hidden lg:flex flex-col gap-8 z-50">
      
      {/* 1. Identity Card */}
      <div className="relative pt-10 pb-6 px-6 rounded-[32px] bg-gradient-to-b from-[#5574a9]/10 to-transparent border border-white/5 text-center">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-slate-800 border-4 border-[#45a79a] p-1 overflow-hidden shadow-[0_0_20px_rgba(69,167,154,0.3)]">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-black text-xl italic uppercase">
            {user.display_name?.substring(0, 2) || "PI"}
          </div>
        </div>
        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mt-4 leading-none">
          {user.display_name}
        </h3>
        <p className="text-[10px] font-bold text-[#45a79a] uppercase tracking-[0.2em] mb-4 mt-1">
          Pioneer Grade 01 // XP: {user.xp || 0}
        </p>
        
        <div className="flex justify-center gap-2">
          <div className="p-2 rounded-xl bg-white/5 text-[#d7a94a] border border-white/5">
            <Award size={16} />
          </div>
          <div className="p-2 rounded-xl bg-white/5 text-[#88be56] border border-white/5">
            <Shield size={16} />
          </div>
        </div>
      </div>

      {/* 2. Navigation Hub */}
      <nav className="flex flex-col gap-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1 text-left">Navigation</h4>
        
        <Link href="/student/dashboard" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#45a79a]/5 border border-[#45a79a]/10 hover:border-[#45a79a]/50 transition-all text-left">
          <LayoutDashboard size={18} className="text-[#45a79a]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all">Mission Control</span>
        </Link>

        <Link href="/student/blueprints" className="group flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#5574a9]/50 transition-all text-left">
          <Box size={18} className="text-[#5574a9]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all">Tech Archive</span>
        </Link>

        <Link href="/student/leaderboard" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#d7a94a]/5 border border-[#d7a94a]/10 hover:border-[#d7a94a]/40 transition-all text-left">
          <Trophy size={18} className="text-[#d7a94a]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all">Hall of Pioneers</span>
        </Link>
      </nav>

      {/* 3. Tech Inventory (Leader Toolkit) - Now Dynamic & Readable */}
      <div className="space-y-4">
        <div className="px-2 text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Leader Toolkit</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {toolDefinitions.map((tool) => {
            const isUnlocked = unlockedItems.includes(tool.id);
            return (
              <div 
                key={tool.id} 
                className={`aspect-square rounded-2xl border flex flex-col items-center justify-center p-3 text-center gap-2 transition-all duration-500 ${
                  isUnlocked 
                  ? "bg-white/10 border-white/20 text-white shadow-lg" 
                  : "bg-black/40 border-white/5 text-white/5 opacity-40 grayscale"
                }`}
              >
                <Zap 
                  size={16} 
                  className={isUnlocked ? "text-yellow-400 fill-yellow-400 animate-pulse" : "text-white/5"} 
                />
                <span className={`text-[9px] font-black uppercase leading-tight tracking-tighter ${
                  isUnlocked ? "text-white" : "text-white/20"
                }`}>
                  {tool.name}
                </span>
                {!isUnlocked && (
                  <span className="text-[7px] font-bold text-white/20 uppercase tracking-tighter">Locked</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Footer & End Session */}
      <div className="mt-auto space-y-4">
        <button onClick={handleShare} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 hover:bg-white/10 transition-all group">
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div key="copied" initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -5, opacity: 0 }} className="flex items-center gap-2 text-[#88be56]">
                <Zap size={14} fill="currentColor" />
                <span className="text-[9px] font-black uppercase tracking-widest">Link Secured</span>
              </motion.div>
            ) : (
              <motion.div key="share" initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -5, opacity: 0 }} className="flex items-center gap-2 text-slate-500 group-hover:text-white">
                <Share2 size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Share Portfolio</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <button onClick={handleLogout} className="w-full h-14 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-between px-6 transition-all group">
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-red-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">End Session</span>
          </div>
          <ChevronRight size={14} className="text-red-900 group-hover:text-red-500 transition-colors" />
        </button>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <button className="text-slate-600 hover:text-white transition-colors">
            <Settings size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#88be56] animate-pulse" />
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Connection: Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}