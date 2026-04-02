"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, Zap, Flame, Calendar, Shield, 
  ChevronRight, Loader2, AlertCircle, CheckCircle2,
  Trophy, Clock, Plus, Copy, BarChart3, FolderGit2, Star
} from 'lucide-react';

export default function ParentDashboard({ parentId }) {
  const [parentData, setParentData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // PIN & UI State
  const [resettingId, setResettingId] = useState(null);
  const [newPinDisplay, setNewPinDisplay] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(null); 
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [parentRes, studentsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', parentId).single(),
          supabase.from('profiles').select('*').eq('role', 'student').eq('linked_parent_id', parentId)
        ]);

        if (parentRes.error) throw parentRes.error;
        if (studentsRes.error) throw studentsRes.error;
        
        setParentData(parentRes.data);
        setStudents(studentsRes.data || []);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        setError("Failed to load your command center.");
      } finally {
        setLoading(false);
      }
    }

    if (parentId) fetchDashboardData();
  }, [parentId]);

  const handleResetPin = async (studentId) => {
    setResettingId(studentId);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/students/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, studentId })
      });

      const data = await response.json();

      if (response.ok) {
        setNewPinDisplay({
          id: studentId,
          name: data.studentIdentifier,
          pin: data.newPin
        });
        setShowResetConfirm(null);
      } else {
        setError(data.error || "Failed to reset PIN.");
      }
    } catch (err) {
      setError("An error occurred while resetting the PIN.");
    } finally {
      setResettingId(null);
    }
  };

  const copyToClipboard = async (pin) => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getLastActiveText = (dateString) => {
    if (!dateString) return "Awaiting First Login";
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
    if (days === 0) return "Active Today";
    if (days === 1) return "Active Yesterday";
    return `Active ${days} days ago`;
  };

  // --- Aggregate Stats & Gamification ---
  const totalXP = students.reduce((acc, kid) => acc + (kid.xp || 0), 0);
  const bestStreak = students.length > 0 ? Math.max(0, ...students.map(k => k.current_streak || 0)) : 0;
  const isDemo = parentData?.payment_plan_preference === 'demo';

  // Calculate Household Tier
  const getHouseholdTier = (xp) => {
    if (xp < 500) return { title: "Initiate Hub", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (xp < 2500) return { title: "Pioneer Hub", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (xp < 10000) return { title: "Quantum Hub", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" };
    return { title: "Apex Hub", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
  };
  const householdTier = getHouseholdTier(totalXP);

  // Animation Variants
  const containerVars = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="animate-spin text-blue-500 relative z-10" size={48} />
        </div>
        <p className="font-black tracking-[0.2em] uppercase text-xs text-blue-400/80 animate-pulse">Establishing Secure Link...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* 1. PREMIUM HEADER SECTION */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
        {/* Abstract Background Glow that moves on hover */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 transition-transform duration-1000 group-hover:translate-x-1/4 group-hover:-translate-y-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDemo ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]'}`}>
                {isDemo ? 'Trial Access' : 'Pro Member'}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                <Shield size={12} /> Guard Mode Active
              </span>
              {students.length > 0 && (
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${householdTier.bg} ${householdTier.color} ${householdTier.border}`}>
                  <Star size={12} /> {householdTier.title}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Welcome, {parentData?.display_name?.split(' ')[0] || 'Guardian'}
            </h1>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              Empowering your household to redefine African dreams, one line of code at a time. Manage accounts, track progress, and secure access from your central command.
            </p>
          </div>

          {/* Household Aggregate Stats */}
          {students.length > 0 && (
            <div className="flex gap-4">
              <div className="bg-[#020617]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 min-w-[130px] shadow-xl">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Zap size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Family XP</span>
                </div>
                <div className="text-3xl font-black text-white">{totalXP.toLocaleString()}</div>
              </div>
              <div className="bg-[#020617]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 min-w-[130px] shadow-xl">
                <div className="flex items-center gap-2 text-orange-400 mb-2">
                  <Flame size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Top Streak</span>
                </div>
                <div className="text-3xl font-black text-white">{bestStreak}</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ERROR BANNER */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 shadow-lg">
            <AlertCircle size={20} />
            <p className="font-bold text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. STUDENT ROSTER */}
      <div className="space-y-6">
        <h2 className="text-xl font-black uppercase italic text-white px-2 flex items-center gap-2 tracking-tight">
          <Trophy size={20} className="text-blue-400"/> Enrolled Pioneers
        </h2>

        {students.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-2 border-dashed border-white/10 rounded-[32px] p-16 text-center space-y-5 bg-white/[0.02]">
            <div className="w-24 h-24 bg-[#0f172a] rounded-full flex items-center justify-center mx-auto shadow-2xl border border-white/5 relative">
              <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-ping" />
              <Plus size={36} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">No Students Found</h3>
            <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed">You haven't added any students to your secure household yet. Enroll a student to initialize their portal!</p>
          </motion.div>
        ) : (
          <motion.div variants={containerVars} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {students.map((student) => {
              const isResettingThis = resettingId === student.id;
              const isShowingConfirm = showResetConfirm === student.id;
              const hasNewPin = newPinDisplay?.id === student.id;
              const initials = (student.display_name || "??").substring(0, 2).toUpperCase();

              return (
                <motion.div key={student.id} variants={itemVars} className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-xl hover:shadow-blue-500/10 hover:border-white/20 transition-all duration-500 flex flex-col">
                  
                  {/* Card Header & Avatar */}
                  <div className="p-6 border-b border-white/5 flex items-center gap-5 bg-gradient-to-b from-white/[0.02] to-transparent">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] flex-shrink-0 border border-white/20">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-black text-white truncate tracking-tight">{student.display_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-xs font-bold text-slate-300 bg-[#020617] px-2.5 py-1 rounded-md border border-white/10 truncate shadow-inner">
                          @{student.student_identifier}
                        </span>
                        {student.squad_name && (
                          <span className="text-xs font-black text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20 truncate uppercase tracking-wider">
                            {student.squad_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 divide-x divide-white/5 bg-[#020617]/50">
                    <div className="p-5 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <Zap size={14} className="text-blue-400"/> <span className="text-[10px] font-black uppercase tracking-widest">Skill Tokens</span>
                      </div>
                      <span className="text-2xl font-black text-white">{student.xp || 0}</span>
                    </div>
                    <div className="p-5 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <Flame size={14} className="text-orange-400"/> <span className="text-[10px] font-black uppercase tracking-widest">Current Streak</span>
                      </div>
                      <span className="text-2xl font-black text-white">{student.current_streak || 0}</span>
                    </div>
                  </div>

                  {/* Quick Actions (Teasers) */}
                  <div className="grid grid-cols-2 gap-2 p-4 bg-[#020617] border-t border-white/5">
                    <button disabled className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-slate-500 text-xs font-bold border border-white/5 cursor-not-allowed group/teaser relative overflow-hidden">
                      <BarChart3 size={14} /> Progress Report
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover/teaser:opacity-100 transition-opacity">
                        <span className="text-[9px] uppercase tracking-widest text-blue-400">Unlocking Soon</span>
                      </div>
                    </button>
                    <button disabled className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-slate-500 text-xs font-bold border border-white/5 cursor-not-allowed group/teaser relative overflow-hidden">
                      <FolderGit2 size={14} /> Portfolio
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover/teaser:opacity-100 transition-opacity">
                        <span className="text-[9px] uppercase tracking-widest text-purple-400">Unlocking Soon</span>
                      </div>
                    </button>
                  </div>

                  {/* Security Footer */}
                  <div className="p-5 bg-gradient-to-b from-[#020617] to-black/40 border-t border-white/5 mt-auto">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <Clock size={14} /> {getLastActiveText(student.last_active_date)}
                      </div>
                    </div>

                    {/* PIN MANAGEMENT AREA */}
                    <AnimatePresence mode="wait">
                      {hasNewPin ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                           <div className="flex items-center justify-between mb-3">
                             <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                               <CheckCircle2 size={18} /> PIN Updated Securely
                             </div>
                           </div>
                           
                           <div className="relative group/copy">
                             <div className="bg-[#020617] rounded-xl py-4 text-center text-4xl font-black text-green-400 tracking-[0.25em] shadow-inner font-mono border border-green-500/30">
                               {newPinDisplay.pin}
                             </div>
                             <button 
                               onClick={() => copyToClipboard(newPinDisplay.pin)}
                               className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/copy:opacity-100 transition-all rounded-xl border border-green-400/50 text-green-300 font-bold tracking-widest uppercase text-sm"
                             >
                               {copied ? <span className="flex items-center gap-2"><CheckCircle2 size={16}/> Copied!</span> : <span className="flex items-center gap-2"><Copy size={16}/> Copy PIN</span>}
                             </button>
                           </div>

                           <p className="text-[10px] text-green-500/70 mt-3 text-center uppercase tracking-widest font-bold">Secure this code. It will self-destruct from this view.</p>
                           <button onClick={() => setNewPinDisplay(null)} className="w-full mt-4 py-3 bg-green-500/20 text-green-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-500/30 transition-colors">
                             Acknowledge & Close
                           </button>
                        </motion.div>
                      ) : isShowingConfirm ? (
                        <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                          <p className="text-xs font-bold text-red-400 mb-4 text-center leading-relaxed">Generate a new login PIN? The existing PIN will immediately be revoked and access blocked until updated.</p>
                          <div className="flex gap-3">
                            <button onClick={() => setShowResetConfirm(null)} className="flex-1 py-3 bg-white/5 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors">Abort</button>
                            <button onClick={() => handleResetPin(student.id)} disabled={isResettingThis} className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                              {isResettingThis ? <Loader2 size={16} className="animate-spin" /> : "Confirm Reset"}
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowResetConfirm(student.id)} className="w-full flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/30 transition-all duration-300 group/btn shadow-sm">
                          <div className="flex items-center gap-3 text-slate-300 group-hover/btn:text-white transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover/btn:bg-blue-500/20 group-hover/btn:text-blue-400 transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:-rotate-3">
                              <Key size={16} />
                            </div>
                            <span className="text-sm font-black tracking-wide">Reset Access PIN</span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-white/10 transition-colors">
                            <ChevronRight size={16} className="text-slate-400 group-hover/btn:text-white transition-colors" />
                          </div>
                        </motion.button>
                      )}
                    </AnimatePresence>

                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}