"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { 
  Shield, Award, Box, Zap, Settings, Share2, 
  LayoutDashboard, Trophy, LogOut, ChevronRight, 
  MonitorPlay, ChevronDown, ChevronUp, Clock, Brain
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProfileSidebar() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([]);
  
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // --- SCROLL MANAGEMENT ---
  
  const stopScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const up = scrollTop > 10;
      const down = scrollTop + clientHeight < scrollHeight - 10;
      
      setCanScrollUp(up);
      setCanScrollDown(down);

      if ((!up && scrollIntervalRef.current) || (!down && scrollIntervalRef.current)) {
        stopScrolling();
      }
    }
  }, [stopScrolling]);

  const startScrolling = (direction: 'up' | 'down') => {
    if (!scrollContainerRef.current) return;
    stopScrolling();

    const nudge = direction === 'up' ? -60 : 60;
    scrollContainerRef.current.scrollBy({ top: nudge, behavior: 'smooth' });

    scrollIntervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({ 
          top: direction === 'up' ? -6 : 6, 
          behavior: 'auto' 
        });
        checkScroll();
      }
    }, 16);
  };

  useEffect(() => {
    async function syncSidebarData() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) return;
      const localUser = JSON.parse(sessionData);
      const { data: profile } = await supabase.from('profiles').select('*, inventory').eq('id', localUser.id).single();
      if (profile) {
        setUser(profile);
        setUnlockedItems(profile.inventory || []);
      }
    }
    syncSidebarData();

    window.addEventListener('mouseup', stopScrolling);
    window.addEventListener('touchend', stopScrolling);
    window.addEventListener('resize', checkScroll);

    return () => {
      window.removeEventListener('mouseup', stopScrolling);
      window.removeEventListener('touchend', stopScrolling);
      window.removeEventListener('resize', checkScroll);
      stopScrolling();
    };
  }, [stopScrolling, checkScroll]);

  useEffect(() => { checkScroll(); }, [user, unlockedItems, checkScroll]);

  const handleShare = () => {
    // Disabled functionality for now
    // const url = `${window.location.origin}/student/portfolio/${user?.id || ''}`;
    // navigator.clipboard.writeText(url);
    // setCopied(true);
    // setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBriefing = () => {
    // Disabled functionality for now
    // window.dispatchEvent(new CustomEvent('open-mission-briefing'));
  };

  if (!user) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-80 bg-[#020617] border-l border-white/5 hidden lg:flex flex-col z-50 overflow-hidden">
      
      {/* Header */}
      <div className="p-8 pb-4 shrink-0 relative z-20 bg-[#020617]">
        <div className="relative pt-10 pb-6 px-6 rounded-[32px] bg-gradient-to-b from-[#5574a9]/10 to-transparent border border-white/5 text-center">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-slate-800 border-4 border-[#45a79a] p-1 overflow-hidden shadow-[0_0_20px_rgba(69,167,154,0.3)]">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-black text-xl italic uppercase">
              {user.display_name?.substring(0, 2)}
            </div>
          </div>
          <h3 className="text-xl font-black text-white uppercase italic mt-4 leading-none">{user.display_name}</h3>
          
          {/* Replaced 'Grade 01' with 'Rank' */}
          <p className="text-[10px] font-bold text-[#45a79a] uppercase tracking-[0.2em] mb-4 mt-1">Rank // XP: {user.xp}</p>
          
          <div className="flex justify-center gap-2">
            <div className="p-2 rounded-xl bg-white/5 text-[#d7a94a] border border-white/5"><Award size={16} /></div>
            <div className="p-2 rounded-xl bg-white/5 text-[#88be56] border border-white/5"><Shield size={16} /></div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence>
          {canScrollUp && (
            <motion.button 
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              onMouseDown={() => startScrolling('up')}
              onTouchStart={() => startScrolling('up')}
              className="absolute top-2 left-1/2 -translate-x-1/2 z-40 cursor-pointer pointer-events-auto group"
            >
              <div className="bg-blue-500/20 p-2 rounded-full border border-blue-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:bg-blue-500/40 group-hover:border-blue-400 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] group-hover:scale-110 transition-all animate-bounce">
                <ChevronUp size={18} className="text-blue-400 group-hover:text-white transition-colors" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <div 
          ref={scrollContainerRef} 
          onScroll={checkScroll} 
          className="h-full overflow-y-auto px-8 space-y-8 no-scrollbar scroll-smooth pt-2"
        >
          <nav className="flex flex-col gap-3">
            <h4 className="text-[10px] font-black uppercase text-slate-600 px-2 text-left">Navigation</h4>
            
            {/* Renamed to 'Dashboard' */}
            <Link href="/student/dashboard" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#45a79a]/5 border border-[#45a79a]/10 hover:border-[#45a79a]/50 transition-all text-left">
              <LayoutDashboard size={18} className="text-[#45a79a]" /><span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white">Dashboard</span>
            </Link>
            
            <Link href="/student/blueprints" className="group flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#5574a9]/50 transition-all text-left">
              <Box size={18} className="text-[#5574a9]" /><span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white">Tech Archive</span>
            </Link>
            <Link href="/student/leaderboard" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#d7a94a]/5 border border-[#d7a94a]/10 hover:border-[#d7a94a]/40 transition-all text-left">
              <Trophy size={18} className="text-[#d7a94a]" /><span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white">Hall of Pioneers</span>
            </Link>
            <Link 
              href="/math" 
              className="flex items-center justify-between px-6 py-4 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all group"
            >
              <div className="flex items-center gap-3">
                <Brain size={20} className="group-hover:animate-pulse" />
                <span className="font-black uppercase tracking-widest text-xs">Math Lab</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest">
                Earn Sparks
              </span>
            </Link>
          </nav>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-600 px-2 text-left">Leader Toolkit</h4>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {[
                { id: "redstone", name: "Redstone Wire" }, { id: "logic_gates", name: "Logic Kit" },
                { id: "command_blocks", name: "Command Block" }, { id: "python", name: "Python Script" },
              ].map((tool) => {
                const isUnlocked = unlockedItems.includes(tool.id);
                return (
                  <div key={tool.id} className={`h-20 rounded-2xl border flex flex-col items-center justify-center p-2 text-center gap-1 transition-all duration-500 ${isUnlocked ? "bg-white/10 border-white/20 text-white shadow-lg" : "bg-black/40 border-white/5 text-white/5 opacity-40 grayscale"}`}>
                    <Zap size={14} className={isUnlocked ? "text-yellow-400 fill-yellow-400 animate-pulse" : "text-white/5"} />
                    <span className={`text-[8px] font-black uppercase leading-tight ${isUnlocked ? "text-white" : "text-white/20"}`}>{tool.name}</span>
                    {!isUnlocked && <span className="text-[6px] font-bold text-white/20 uppercase">Locked</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {canScrollDown && (
            <motion.button 
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
              onMouseDown={() => startScrolling('down')}
              onTouchStart={() => startScrolling('down')}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 cursor-pointer pointer-events-auto group"
            >
              <div className="bg-blue-500/20 p-2 rounded-full border border-blue-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:bg-blue-500/40 group-hover:border-blue-400 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] group-hover:scale-110 transition-all animate-bounce">
                <ChevronDown size={18} className="text-blue-400 group-hover:text-white transition-colors" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-8 pt-4 bg-[#020617] border-t border-white/5 mt-auto space-y-4 shrink-0 relative z-20">
        <div className="flex gap-3">
          
          {/* Tutorial Button (Disabled State) */}
          <button disabled className="flex-1 p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-50 relative group">
            <MonitorPlay size={18} className="text-slate-600" />
            <span className="text-[8px] font-black text-slate-500 uppercase italic leading-none">Tutorial</span>
            <div className="absolute -top-2 -right-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md text-[7px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Soon</div>
          </button>

          {/* Share Button (Disabled State) */}
          <button disabled className="flex-1 p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-50 relative group">
             <div className="flex flex-col items-center gap-1 text-slate-600">
               <Share2 size={18} />
               <span className="text-[8px] font-black uppercase text-slate-500">Share</span>
             </div>
             <div className="absolute -top-2 -right-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md text-[7px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Soon</div>
          </button>
        </div>
        
        <button onClick={() => { localStorage.removeItem("pioneer_session"); router.push("/"); }} className="w-full h-14 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-between px-6 transition-all group">
          <div className="flex items-center gap-3"><LogOut size={16} className="text-red-500" /><span className="text-[9px] font-black uppercase text-red-500">End Session</span></div>
          <ChevronRight size={14} className="text-red-900 group-hover:text-red-500 transition-colors" />
        </button>
        
        <div className="pt-2 flex items-center justify-between">
          {/* Settings Button (Disabled State) */}
          <div className="relative group cursor-not-allowed">
            <Settings size={18} className="text-slate-700 opacity-50" />
          </div>
          
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#88be56] animate-pulse" /><span className="text-[9px] font-bold text-slate-600 uppercase">Connection: Active</span></div>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </aside>
  );
}