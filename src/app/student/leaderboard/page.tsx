"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Zap, Star, Target, 
  ArrowLeft, Crown, Search, 
  Loader2, Activity, Minus, User, Calendar
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PioneerCoach from "@/components/ui/PioneerCoach";

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [personalRank, setPersonalRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [searchQuery, setSearchQuery] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [showCoach, setShowCoach] = useState(false);
  const [lastWeekXP, setLastWeekXP] = useState(0);

  const formatXP = (num: number) => new Intl.NumberFormat('en-US').format(num);

  useEffect(() => {
    async function fetchHistoricalData() {
      setLoading(true);
      try {
        const sessionData = localStorage.getItem("pioneer_session");
        const localUser = sessionData ? JSON.parse(sessionData) : null;

        // 1. Calculate the PREVIOUS Full Period (Historical suspense logic)
        const now = new Date();
        const start = new Date();
        const end = new Date();

        if (view === 'weekly') {
          // Calculate Last Monday to Last Sunday
          const day = now.getDay();
          const diffToLastMonday = day === 0 ? 13 : day + 6; 
          start.setDate(now.getDate() - diffToLastMonday);
          start.setHours(0,0,0,0);
          
          end.setDate(start.getDate() + 6);
          end.setHours(23,59,59,999);
        } else {
          // 1st of last month to end of last month
          start.setMonth(now.getMonth() - 1, 1);
          start.setHours(0,0,0,0);
          
          end.setMonth(now.getMonth(), 0);
          end.setHours(23,59,59,999);
        }

        const options: any = { month: 'short', day: 'numeric' };
        setDateLabel(`${start.toLocaleDateString(undefined, options)} — ${end.toLocaleDateString(undefined, options)}`);

        // 2. Fetch Lifetime Squad Standings
        const { data: squadsRes } = await supabase.from('squad_leaderboard').select('*');
        if (squadsRes) {
          setSquads(squadsRes.map(s => ({
            name: s.squad_name,
            xp: s.total_xp,
            color: s.squad_name === "Logic Lions" ? "text-[#45a79a]" : s.squad_name === "Pixel Panthers" ? "text-[#5d4385]" : "text-[#5574a9]",
            bg: s.squad_name === "Logic Lions" ? "bg-[#45a79a]" : s.squad_name === "Pixel Panthers" ? "bg-[#5d4385]" : "bg-[#5574a9]"
          })));
        }

        // 3. Fetch Historical XP Logs for the specific period
        const { data: logs } = await supabase
          .from('xp_logs')
          .select(`amount, profiles ( id, display_name, squad_name )`)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        const grouped = (logs || []).reduce((acc: any, curr: any) => {
          const p = curr.profiles;
          if (!p) return acc;
          if (!acc[p.id]) acc[p.id] = { id: p.id, display_name: p.display_name, squad_name: p.squad_name, xp: 0 };
          acc[p.id].xp += curr.amount;
          return acc;
        }, {});

        const sorted = Object.values(grouped).sort((a: any, b: any) => b.xp - a.xp);
        setLeaders(sorted);

        // 4. Personal Stats & Automatic Nudge
        if (localUser) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
          if (profile) {
            setUser(profile);
            const myHistoricalXP = grouped[localUser.id]?.xp || 0;
            setLastWeekXP(myHistoricalXP);
            
            const rankIndex = sorted.findIndex((l: any) => l.id === localUser.id);
            setPersonalRank(rankIndex !== -1 ? rankIndex + 1 : null);

            // Nudge Logic: Remind every 3rd visit if they haven't achieved their goal
            const visitCount = parseInt(localStorage.getItem("coach_nudge_count") || "0");
            if (visitCount % 3 === 0) setShowCoach(true);
            localStorage.setItem("coach_nudge_count", (visitCount + 1).toString());
          }
        }
      } catch (err) {
        console.error("Historical Sync Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistoricalData();
  }, [view]);

  const renderPodiumSlot = (rankIndex: number, height: string) => {
    const leader = leaders[rankIndex];
    const isFirst = rankIndex === 0;

    return (
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center gap-4">
        <div className="relative">
          {isFirst && <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 text-[#d7a94a] drop-shadow-md" size={32} />}
          <div className={`rounded-full flex items-center justify-center font-black italic border-4 transition-all ${leader ? `w-20 h-20 md:w-24 md:h-24 text-2xl ${isFirst ? 'border-[#d7a94a] bg-[#d7a94a]/20' : 'border-slate-500 bg-white/5'}` : 'w-16 h-16 border-white/5 bg-white/5 opacity-20'}`}>
            {leader ? leader.display_name.substring(0,2).toUpperCase() : <User size={24} />}
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black italic ${leader ? 'bg-[#d7a94a] text-black' : 'bg-slate-800 text-slate-500'}`}>
            #{rankIndex + 1}
          </div>
        </div>
        <div className={`w-full rounded-t-[32px] p-4 text-center border-x border-t transition-all ${height} ${leader ? (isFirst ? 'bg-[#d7a94a]/10 border-[#d7a94a]/30' : 'bg-white/5 border-white/10') : 'bg-white/[0.02] border-white/5'}`}>
          <p className={`font-black uppercase italic truncate ${leader ? 'text-white' : 'text-slate-700'}`}>
            {leader ? leader.display_name : "Scanning..."}
          </p>
          <p className="text-[10px] font-black text-slate-600">
            {leader ? `${formatXP(leader.xp)} XP` : "No Record"}
          </p>
        </div>
      </motion.div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="text-[#d7a94a] animate-spin" size={40} />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 text-center">Opening_Archives...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] p-8 md:p-16 text-white text-left font-sans relative overflow-hidden">
      <AnimatePresence>
        {showCoach && (
          <PioneerCoach 
            lastWeekXP={lastWeekXP} 
            winnerXP={leaders[0]?.xp || 0} 
            currentXP={user?.xp || 0}
            userId={user?.id}
            onClose={() => setShowCoach(false)} 
          />
        )}
      </AnimatePresence>

      <header className="mb-12 space-y-4 relative z-10">
        <Link href="/student/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors group mb-4">
          <ArrowLeft size={16} className="group-hover:-translate-x-1" />
          <span className="text-[10px] font-black uppercase tracking-widest">Return_to_Dashboard</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">
            Hall of <span className="text-[#d7a94a]">Pioneers</span>
          </h1>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#d7a94a]/10 border border-[#d7a94a]/20 rounded-2xl mb-1">
            <Calendar size={14} className="text-[#d7a94a]" />
            <span className="text-[10px] font-black text-[#d7a94a] uppercase tracking-widest">{dateLabel}</span>
          </div>
        </div>
      </header>

      <div className="flex justify-center mb-16 relative z-10">
        <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex gap-1 shadow-2xl">
          {['weekly', 'monthly'].map((t) => (
            <button key={t} onClick={() => setView(t as any)} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === t ? 'bg-[#d7a94a] text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              {t === 'weekly' ? 'Last Week' : 'Last Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
        {/* LEFT COLUMN: Personal Performance & Squads */}
        <div className="lg:col-span-1 space-y-8">
          <section className="p-8 rounded-[48px] bg-white/5 border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity size={60} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8">Pioneer_Archive_Rank</p>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-[#5574a9]/20 border-2 border-[#5574a9] flex items-center justify-center font-black italic text-xl">
                {user?.display_name?.substring(0,2).toUpperCase() || "PI"}
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{user?.display_name}</h2>
                <p className="text-[9px] font-bold text-[#45a79a] uppercase tracking-widest mt-1">{user?.squad_name}</p>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-black italic tracking-tighter leading-none">{formatXP(lastWeekXP)}</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Achieved_XP</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-[#d7a94a] uppercase">Rank</p>
                <p className="text-xl font-black italic text-white leading-none">{personalRank ? `#${personalRank}` : '---'}</p>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 px-2">Squad_Standings</h4>
            {squads.map(s => (
              <div key={s.name} className="p-6 rounded-[32px] bg-white/5 border border-white/5 flex justify-between items-center hover:bg-white/[0.08] transition-colors">
                <span className={`text-xs font-black uppercase italic ${s.color}`}>{s.name}</span>
                <span className="text-lg font-black italic text-white">{formatXP(s.xp)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Podium & List */}
        <div className="lg:col-span-2 space-y-12">
          {/* Historical Podium */}
          <section className="grid grid-cols-3 gap-4 items-end min-h-[300px] px-4">
            {renderPodiumSlot(1, "h-28")}
            {renderPodiumSlot(0, "h-40")}
            {renderPodiumSlot(2, "h-24")}
          </section>

          {/* Extended Ranks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-6 mb-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Global_Ranks</h4>
            </div>

            {leaders.length <= 3 ? (
              <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[32px]">
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Archive Sealed for this Period</p>
              </div>
            ) : (
              leaders.slice(3).filter(l => l.display_name.toLowerCase().includes(searchQuery.toLowerCase())).map((l, i) => (
                <div key={l.id} className={`flex items-center justify-between p-6 rounded-[32px] bg-white/5 border transition-all ${l.id === user?.id ? 'border-[#d7a94a]/40 bg-[#d7a94a]/5' : 'border-white/5 hover:bg-white/[0.08]'}`}>
                  <div className="flex items-center gap-6">
                    <span className="text-xl font-black italic text-slate-800 w-8">#{i + 4}</span>
                    <p className="text-lg font-black uppercase italic tracking-tighter leading-none">{l.display_name}</p>
                  </div>
                  <p className="text-xl font-black italic text-white text-right">{formatXP(l.xp)} <span className="text-[8px] not-italic text-slate-600 uppercase">XP</span></p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PERSISTENT ACTION: Call Coach Briefing */}
      <button 
        onClick={() => setShowCoach(true)}
        className="fixed bottom-10 right-10 z-40 group flex items-center gap-3 p-2 pr-6 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/50 transition-all shadow-2xl hover:scale-105 active:scale-95"
      >
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
          <Zap size={20} fill="currentColor" />
        </div>
        <div className="text-left">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Briefing_Available</p>
          <p className="text-xs font-black uppercase italic tracking-tighter text-white">Call_Coach</p>
        </div>
      </button>
    </main>
  );
}