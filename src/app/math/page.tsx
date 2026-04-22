"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { 
  Zap, Brain, Triangle, Ruler, BarChart, 
  CheckCircle2, Play, Clock, ChevronRight, Sparkles,
  Cpu, Mail, ArrowRight, Loader2, X, Target, Trophy
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SECTORS = [
  { id: 'numbers', title: 'Numbers & Ops', weight: '50%', gradient: 'from-blue-600 to-blue-800', shadow: 'shadow-blue-900/20', icon: Brain, description: 'Number sense, fractions, and calculation logic.' },
  { id: 'algebra', title: 'Patterns & Algebra', weight: '10%', gradient: 'from-purple-600 to-purple-800', shadow: 'shadow-purple-900/20', icon: Zap, description: 'Flow diagrams, number sentences, and rules.' },
  { id: 'geometry', title: 'Space & Shape', weight: '15%', gradient: 'from-orange-500 to-red-600', shadow: 'shadow-orange-900/20', icon: Triangle, description: '2D shapes, 3D objects, and symmetry.' },
  { id: 'measurement', title: 'Measurement', weight: '15%', gradient: 'from-emerald-500 to-teal-700', shadow: 'shadow-emerald-900/20', icon: Ruler, description: 'Time, length, mass, and volume labs.' },
  { id: 'data', title: 'Data Handling', weight: '10%', gradient: 'from-indigo-600 to-blue-900', shadow: 'shadow-indigo-900/20', icon: BarChart, description: 'Graphs, probability, and statistics.' },
];

export default function MathQuestMap() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasCompletedSprint, setHasCompletedSprint] = useState(false);
  const [loading, setLoading] = useState(true);

  // Leaderboard & Rewards Shared State
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [isMobileLeaderboardOpen, setIsMobileLeaderboardOpen] = useState(false); // ADDED FOR MOBILE APP FEEL
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [leaderboardTab, setLeaderboardTab] = useState<string>('overall');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [isLoadingLeaders, setIsLoadingLeaders] = useState(false);
  const [expandedMobileSector, setExpandedMobileSector] = useState<string | null>(null);

  useEffect(() => {
    async function checkDailySprintAndProfile() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) return;
      const localUser = JSON.parse(sessionData);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      setUserProfile(profile);

      const today = new Date().toISOString().split('T')[0];
      const { data: sprint } = await supabase
        .from('math_daily_sprints')
        .select('id')
        .eq('student_id', localUser.id)
        .gte('created_at', today)
        .limit(1);

      if (sprint && sprint.length > 0) setHasCompletedSprint(true);
      setLoading(false);
    }
    checkDailySprintAndProfile();
  }, []);

  useEffect(() => {
    async function fetchLeaders() {
      setIsLoadingLeaders(true);
      try {
        const sortColumn = leaderboardTab === 'overall' ? 'sparks' : `${leaderboardTab}_xp`;

        const { data, error } = await supabase
          .from('profiles')
          .select(`student_identifier, ${sortColumn}`)
          .not(sortColumn, 'is', null) 
          .order(sortColumn, { ascending: false })
          .limit(5);

        if (error) throw error;
        setLeaders(data || []);
      } catch (error: any) {
        setLeaders([]);
      } finally {
        setIsLoadingLeaders(false);
      }
    }
    fetchLeaders();
  }, [leaderboardTab]);

  const handleUnlockMission = async () => {
    if (!userProfile || userProfile.sparks < 5) return;
    setUnlockStatus('processing');
    try {
      const newSparks = userProfile.sparks - 5;
      await supabase.from('profiles').update({ sparks: newSparks }).eq('id', userProfile.id);
      setUserProfile((prev: any) => ({ ...prev, sparks: newSparks }));
      await new Promise(resolve => setTimeout(resolve, 2500)); 
      setUnlockStatus('success');
    } catch (error) {
      setUnlockStatus('idle');
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#0B1120] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing_World</span>
    </div>
  );

  const stats = {
    xp: userProfile?.xp || 0,
    level: (userProfile?.xp || 0) >= 1000 ? 2 : 1,
    currentLevel: { name: "Pioneer", code: "MTH-01", accentColor: "#3b82f6", floor: 0 },
    nextLevel: { name: "Math Lead", xpRequired: 1000 }
  };

  const getLeaderScore = (leader: any) => {
    const score = leaderboardTab === 'overall' ? leader.sparks : leader[`${leaderboardTab}_xp`];
    return score || 0;
  };

  const formatUsername = (identifier: string, index: number) => identifier || `Pioneer_${index + 104}`;

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#F8FAFC] text-slate-900 relative overflow-hidden pb-24">
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* ========================================================= */}
        {/* MOBILE VIEW (Hidden on large screens, optimized for App feel) */}
        {/* ========================================================= */}
        <div className="block lg:hidden relative z-10 px-4 pt-4 space-y-5 pb-28">
          
          {/* Mobile Sticky Header */}
          <header className="sticky top-2 z-40 flex justify-between items-center bg-white/70 backdrop-blur-xl p-3.5 rounded-[24px] border border-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                 <Target size={20} className="text-white" />
              </div>
              <div className="leading-tight">
                 <h1 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">
                    Quest<span className="text-blue-600">_Map</span>
                 </h1>
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Logic Interface</span>
              </div>
            </div>
            <button onClick={() => setIsRewardsOpen(true)} className="flex items-center gap-1.5 bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-200 px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-sm">
               <span className="text-base font-black text-amber-600 italic tabular-nums leading-none">{userProfile?.sparks || 0}</span>
               <Zap size={16} className="text-amber-500 drop-shadow-sm" fill="currentColor" />
            </button>
          </header>

          {/* Dynamic Encouragement Banner (Psychological Pull) */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-1 p-3.5 rounded-2xl border flex items-start gap-3 shadow-sm ${hasCompletedSprint ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100/60' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100/60'}`}
          >
            <div className="bg-white rounded-full p-2 shadow-sm shrink-0 mt-0.5">
               {hasCompletedSprint ? <Sparkles size={16} className="text-emerald-500" /> : <Brain size={16} className="text-blue-500 animate-pulse" />}
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 tracking-tight uppercase">
                {hasCompletedSprint ? "Logic Core: 100% Charged!" : "Awaiting Daily Initialization"}
              </h3>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed mt-1">
                {hasCompletedSprint 
                  ? "Sprint complete! Your neural pathways are primed. Dive into a lab below to convert this momentum into BrainBux." 
                  : "Your labs are currently locked. Complete your quick Brain Check to power up the network!"}
              </p>
            </div>
          </motion.div>

          {/* Sub Header row: CAPS + Leaderboard Trigger Button */}
          <div className="flex items-center justify-between px-1">
            <div className="bg-white/80 backdrop-blur border border-slate-200 px-3 py-2 rounded-xl shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">CAPS Gr 4-6</span>
            </div>
            <button 
              onClick={() => setIsMobileLeaderboardOpen(true)} 
              className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-transform"
            >
              <Trophy size={14} className="text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest">Rankings</span>
            </button>
          </div>

          {/* Premium Mobile Labs Grid (2x2 Expanding) */}
          <div className="relative grid grid-cols-2 gap-3 px-1">
            {SECTORS.map((sector) => {
              const isExpanded = expandedMobileSector === sector.id;

              return (
                <motion.div 
                  layout
                  key={sector.id}
                  className={`relative overflow-hidden bg-gradient-to-br ${sector.gradient} shadow-[0_15px_30px_rgba(0,0,0,0.15)] text-white active:scale-[0.97] transition-all duration-200 cursor-pointer ${!hasCompletedSprint ? 'blur-[3px] grayscale opacity-60 pointer-events-none' : ''} ${isExpanded ? 'col-span-2 rounded-[32px] p-6' : 'col-span-1 rounded-[28px] p-5 aspect-square flex flex-col justify-center items-center text-center border-t border-white/20'}`}
                  onClick={() => {
                    if (!hasCompletedSprint) return;
                    // Toggle expansion state
                    setExpandedMobileSector(isExpanded ? null : sector.id);
                  }}
                >
                  {/* Glossy Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />
                  
                  {/* Dynamic Background Icon */}
                  <sector.icon className={`absolute opacity-[0.08] transition-all duration-500 ease-out ${isExpanded ? '-right-4 -bottom-4 w-40 h-40 rotate-12' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32'}`} />

                  <div className={`relative z-10 flex ${isExpanded ? 'flex-col gap-4' : 'flex-col items-center gap-3 w-full'}`}>
                    
                    {/* Header Row / Centered Icon */}
                    <motion.div layout className={`flex ${isExpanded ? 'items-start justify-between w-full' : 'items-center justify-center w-full'}`}>
                      <motion.div layout className={`bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)] ${isExpanded ? 'w-14 h-14' : 'w-12 h-12'}`}>
                        <sector.icon size={isExpanded ? 26 : 22} className="drop-shadow-md" />
                      </motion.div>
                      
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-sm">
                          <span className="text-[8px] font-black text-white/90 uppercase tracking-widest">{sector.weight} Weight</span>
                        </motion.div>
                      )}
                    </motion.div>
                    
                    {/* Title & Description */}
                    <motion.div layout className={`w-full ${isExpanded ? '' : 'flex flex-col items-center'}`}>
                      <motion.h3 layout className={`font-black uppercase italic tracking-tighter leading-tight drop-shadow-lg ${isExpanded ? 'text-2xl mb-1.5' : 'text-sm text-center'}`}>
                        {sector.title}
                      </motion.h3>
                      {isExpanded && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[10px] text-white/70 font-medium leading-tight max-w-[85%] mt-1">
                          {sector.description}
                        </motion.p>
                      )}
                    </motion.div>

                    {/* Interactive Mastery Footer (Only when zoomed) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 flex items-center justify-between bg-black/20 backdrop-blur-sm p-2.5 rounded-2xl border border-white/10 shadow-inner w-full"
                        >
                          <div className="flex-1 mr-4 pl-2">
                            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/80 mb-1.5">
                              <span>Mastery Level</span><span>1</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                              <div className="h-full bg-gradient-to-r from-white/50 to-white rounded-full w-[15%] shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                            </div>
                          </div>
                          
                          {/* The actual navigation button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents the card from collapsing
                              router.push(`/math/lab/${sector.id}`);
                            }}
                            className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.2)] active:bg-slate-100 transition-colors"
                          >
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}

            {/* Mobile Locked Overlay */}
            <AnimatePresence>
              {!hasCompletedSprint && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center p-2">
                  <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-8 rounded-[40px] shadow-2xl w-full text-center space-y-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent" />
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30 relative z-10">
                      <Clock size={32} />
                    </div>
                    <div className="relative z-10">
                      <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Access Denied</h2>
                      <p className="text-slate-400 text-xs font-medium leading-relaxed">Complete your daily Brain Check to unlock the labs.</p>
                    </div>
                    <button onClick={() => router.push('/math/sprint')} className="relative z-10 flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-[10px] shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all">
                      Start Brain Check <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* BOTTOM SHEET LEADERBOARD (Mobile Only) */}
          <AnimatePresence>
            {isMobileLeaderboardOpen && (
              <div className="fixed inset-0 z-[110] flex items-end justify-center lg:hidden">
                 <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                    onClick={() => setIsMobileLeaderboardOpen(false)} 
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
                 />
                 <motion.div 
                    initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                    className="relative w-full bg-white rounded-t-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-t border-slate-200"
                 >
                    {/* iOS style Drag Handle */}
                    <div className="w-full flex justify-center pt-4 pb-2"><div className="w-12 h-1.5 bg-slate-200 rounded-full" /></div>

                    <div className="px-6 pb-8 pt-2 overflow-y-auto">
                       {/* Header */}
                       <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center border border-amber-100 shadow-inner">
                                <Trophy size={20} />
                             </div>
                             <div>
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Rankings</h2>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Global Top Earners</p>
                             </div>
                          </div>
                          <button onClick={() => setIsMobileLeaderboardOpen(false)} className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center active:scale-90 transition-transform"><X size={16} /></button>
                       </div>

                       {/* Scrolling Tabs */}
                       <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide -mx-2 px-2">
                          {['overall', 'numbers', 'algebra', 'geometry', 'measurement', 'data'].map((tab) => (
                             <button 
                               key={tab} 
                               onClick={() => setLeaderboardTab(tab)} 
                               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${leaderboardTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                             >
                               {tab}
                             </button>
                          ))}
                       </div>

                       {/* Rankings List */}
                       <div className="space-y-2.5">
                          {isLoadingLeaders ? (
                             <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
                          ) : (
                             <>
                               {leaders.slice(0, 5).map((leader, idx) => (
                                 <motion.div 
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                                    key={idx} 
                                    className={`flex items-center justify-between p-3 rounded-2xl border ${idx === 0 ? 'bg-amber-50/40 border-amber-100 shadow-sm' : idx === 1 ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-white border-slate-100'}`}
                                 >
                                    <div className="flex items-center gap-3.5">
                                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md' : idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                          {idx + 1}
                                       </div>
                                       <span className="font-bold text-slate-700 text-sm truncate max-w-[120px]">{formatUsername(leader.student_identifier, idx)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">
                                       <span className="text-sm font-black text-amber-500 italic tabular-nums">{getLeaderScore(leader)}</span>
                                       {leaderboardTab === 'overall' ? <Zap size={12} className="text-amber-400 drop-shadow-sm" fill="currentColor" /> : <span className="text-[9px] font-black text-amber-400 uppercase">XP</span>}
                                    </div>
                                 </motion.div>
                               ))}
                               {leaders.length === 0 && (
                                  <p className="text-xs text-center text-slate-400 font-bold uppercase tracking-widest py-8">Awaiting Data Core...</p>
                               )}
                             </>
                          )}
                       </div>
                    </div>
                 </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>

        {/* ========================================================= */}
        {/* DESKTOP VIEW (Hidden on Mobile, exactly as you requested)   */}
        {/* ========================================================= */}
        <div className="hidden lg:block max-w-6xl mx-auto p-6 md:p-8 lg:p-12 space-y-8 relative z-10">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Target size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sector Selection</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none text-slate-900 drop-shadow-sm">
                Quest_<span className="text-blue-600 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Map</span>
              </h1>
            </div>

            <button 
              onClick={() => setIsRewardsOpen(true)}
              className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-[32px] border border-white shadow-lg flex items-center gap-6 hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className="text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BrainBux Balance</p>
                <p className="text-3xl font-black text-amber-500 italic leading-none tabular-nums">{userProfile?.sparks || 0}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 shadow-inner group-hover:rotate-12 transition-transform">
                <Zap size={28} fill="currentColor" />
              </div>
            </button>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            
            <div className="xl:col-span-2 relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {SECTORS.map((sector, index) => {
                  const isFeatured = index === 0;
                  return (
                    <motion.div 
                      key={sector.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`group relative overflow-hidden rounded-[40px] bg-gradient-to-br ${sector.gradient} shadow-xl ${sector.shadow} transition-all hover:scale-[1.02] hover:shadow-2xl cursor-pointer ${!hasCompletedSprint ? 'blur-[3px] grayscale opacity-40 pointer-events-none' : ''} ${isFeatured ? 'sm:col-span-2' : ''}`}
                      onClick={() => { if(hasCompletedSprint) router.push(`/math/lab/${sector.id}`); }}
                    >
                      <sector.icon className="absolute -bottom-8 -right-8 w-64 h-64 text-white opacity-10 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" />
                      
                      <div className="relative z-10 p-8 md:p-10 flex flex-col h-full min-h-[280px]">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-[20px] flex items-center justify-center text-white mb-6 shadow-inner">
                              <sector.icon size={28} />
                            </div>
                            <div className="bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">
                              {sector.weight} Weight
                            </div>
                          </div>
                          
                          <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white leading-none mb-3 drop-shadow-md">
                            {sector.title}
                          </h3>
                          <p className="text-white/80 text-sm font-medium leading-relaxed max-w-[85%]">
                            {sector.description}
                          </p>
                        </div>
                        
                        <div className="mt-8 flex items-end justify-between">
                          <div className="w-1/2 space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70">
                              <span>Mastery</span>
                              <span>Lvl 1</span>
                            </div>
                            <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden border border-white/10">
                              <div className="h-full bg-white rounded-full w-[15%]" />
                            </div>
                          </div>

                          <div className="w-14 h-14 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] group-hover:bg-slate-900 group-hover:text-white transition-colors">
                            <Play size={24} fill="currentColor" className="ml-1" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <AnimatePresence>
                {!hasCompletedSprint && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 flex items-center justify-center"
                  >
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-10 rounded-[50px] shadow-2xl max-w-sm text-center space-y-6">
                      <div className="w-20 h-20 bg-blue-500/20 text-blue-400 rounded-[28px] flex items-center justify-center mx-auto border border-blue-500/30">
                        <Clock size={40} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Access Denied</h2>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                          The Lab network is locked. Complete your daily Brain Check to power up the modules.
                        </p>
                      </div>
                      <button 
                        onClick={() => router.push('/math/sprint')}
                        className="flex items-center justify-center gap-3 w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-xs hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                      >
                        Start Brain Check <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white border border-slate-200 p-6 rounded-[32px] shadow-sm flex items-center gap-5">
                 <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                 </div>
                 <div>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Curriculum Sync</h3>
                   <p className="text-sm font-black text-slate-800 uppercase tracking-wide">Unified CAPS Gr 4-6</p>
                 </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col h-full min-h-[500px]">
                 <div className="flex items-center gap-3 text-slate-800 mb-6">
                   <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center border border-amber-100">
                     <Trophy size={20} />
                   </div>
                   <div>
                     <h2 className="text-lg font-black uppercase italic tracking-tighter leading-none">Global Ranks</h2>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Top Earners Network</p>
                   </div>
                 </div>

                 <div className="flex flex-wrap gap-2 mb-6">
                   {['overall', 'numbers', 'algebra', 'geometry', 'measurement', 'data'].map((tab) => (
                     <button 
                       key={tab}
                       onClick={() => setLeaderboardTab(tab)}
                       className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${leaderboardTab === tab ? 'bg-slate-900 text-white shadow-md scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                     >
                       {tab.substring(0, 4)}
                     </button>
                   ))}
                 </div>

                 <div className="flex-1 space-y-3 relative bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-hidden">
                   {isLoadingLeaders ? (
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                     </div>
                   ) : (
                     <>
                       {leaders.slice(0, 5).map((leader, idx) => (
                         <motion.div 
                           initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                           key={idx} 
                           className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm"
                         >
                           <div className="flex items-center gap-3">
                             <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'}`}>
                               {idx + 1}
                             </div>
                             <span className="font-bold text-slate-700 text-xs truncate max-w-[100px]">
                               {formatUsername(leader.student_identifier, idx)}
                             </span>
                           </div>
                           <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                             <span className="text-xs font-black text-amber-500 tabular-nums">
                                {getLeaderScore(leader)}
                             </span>
                             {leaderboardTab === 'overall' ? (
                                <Zap size={12} className="text-amber-400" fill="currentColor" />
                             ) : (
                                <span className="text-[8px] font-black uppercase text-amber-400">XP</span>
                             )}
                           </div>
                         </motion.div>
                       ))}
                       {leaders.length === 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                             <BarChart className="text-slate-300 mb-2" size={24} />
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                               Awaiting Data Core
                             </p>
                          </div>
                       )}
                     </>
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* SHARED REWARDS MODAL (Works on both) */}
        <AnimatePresence>
          {isRewardsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { if(unlockStatus !== 'processing') setIsRewardsOpen(false); }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 40 }} 
                className="relative w-full max-w-xl bg-white border border-white rounded-[50px] shadow-[0_50px_120px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-5 text-left">
                    <div className="w-14 h-14 bg-amber-50 border border-amber-100 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner">
                      <Zap size={28} fill="currentColor" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Pioneer Depot</h2>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        Balance: {userProfile?.sparks || 0} BrainBux
                      </p>
                    </div>
                  </div>
                  {unlockStatus !== 'processing' && (
                    <button onClick={() => setIsRewardsOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-2xl transition-all">
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="p-8 md:p-10 bg-slate-50/50">
                  {unlockStatus === 'idle' && (
                    <div className="space-y-8">
                      <div className="text-left space-y-2">
                        <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-800">New Mission Detected</h3>
                        <p className="text-sm text-slate-500 font-medium">Trade your BrainBux to unlock premium engineering missions.</p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-[36px] p-8 flex flex-col items-center gap-6 shadow-sm">
                        <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-[28px] flex items-center justify-center text-blue-500 shadow-inner">
                          <Cpu size={40} />
                        </div>
                        <div className="text-center space-y-3">
                          <h4 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Smart Home Protocol</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto text-center">Build an automated logic system using robotics hardware components.</p>
                        </div>
                        <div className="bg-slate-900 text-white px-8 py-3 rounded-full flex items-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200">
                          Cost: <span className="text-amber-400 flex items-center gap-1"><Zap size={14} fill="currentColor"/> 5 Bux</span>
                        </div>
                      </div>

                      <div className="pt-4">
                        {(userProfile?.sparks || 0) >= 5 ? (
                          <button 
                            onClick={handleUnlockMission}
                            className="w-full py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase italic tracking-widest text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 active:scale-[0.98]"
                          >
                            Spend 5 BrainBux to Unlock
                          </button>
                        ) : (
                          <div className="w-full py-6 bg-slate-200 text-slate-400 rounded-[28px] font-black uppercase italic tracking-widest text-xs text-center cursor-not-allowed">
                            Need {5 - (userProfile?.sparks || 0)} more BrainBux
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {unlockStatus === 'processing' && (
                    <div className="py-20 flex flex-col items-center justify-center gap-8">
                      <div className="relative">
                        <Loader2 className="animate-spin text-blue-600" size={64} />
                        <div className="absolute inset-0 blur-2xl bg-blue-400/20 animate-pulse" />
                      </div>
                      <div className="text-center space-y-3">
                        <h3 className="text-2xl font-black uppercase italic tracking-widest text-slate-900 leading-none">Saving results...</h3>
                        <p className="text-slate-500 text-sm font-medium">Archiving performance data and notifying Parent.</p>
                      </div>
                    </div>
                  )}

                  {unlockStatus === 'success' && (
                    <div className="py-6 flex flex-col items-center text-center space-y-8">
                      <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center shadow-inner border border-emerald-100">
                        <CheckCircle2 size={48} />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Unlocked!</h3>
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[28px] p-6 text-left flex items-start gap-5">
                          <Mail className="text-emerald-600 shrink-0 mt-1" size={20} />
                          <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                            <span className="font-black block mb-1">Email Sent:</span>
                            Parent authorized. High logic aptitude detected. A new engineering mission has been added to your dashboard.
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => router.push('/student/dashboard')}
                        className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black uppercase italic tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3"
                      >
                        Enter Engineering Bay <ArrowRight size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}