"use client";

import { motion } from "framer-motion";
import { Zap, TrendingUp, Trophy, X, ShieldCheck, CheckSquare, Sparkles, Loader2, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

interface CoachProps {
  lastWeekXP: number;
  winnerXP: number;
  currentXP: number;
  onClose: () => void;
  userId: string;
}

export default function PioneerCoach({ lastWeekXP, winnerXP, currentXP, onClose, userId }: CoachProps) {
  const [completed, setCompleted] = useState<boolean[]>([false, false, false]);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function verifyMissions() {
      try {
        const now = new Date();
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0,0,0,0);

        const { data: currentLogs } = await supabase
          .from('xp_logs')
          .select('amount, created_at')
          .eq('student_id', userId)
          .gte('created_at', startOfWeek.toISOString());

        const totalEarnedThisWeek = currentLogs?.reduce((sum, log) => sum + log.amount, 0) || 0;
        const hasLogToday = currentLogs?.some(log => 
          new Date(log.created_at).toDateString() === now.toDateString()
        );

        const mission1 = lastWeekXP > 0 && totalEarnedThisWeek >= Math.round(lastWeekXP * 1.15);
        const mission2 = winnerXP > 0 && totalEarnedThisWeek >= winnerXP;
        const mission3 = !!hasLogToday;

        setCompleted([mission1, mission2, mission3]);
      } catch (err) {
        console.error("Coach verification failed:", err);
      } finally {
        setLoading(false);
      }
    }
    if (userId) verifyMissions();
  }, [userId, lastWeekXP, winnerXP]);

  const handleUnlockElite = async () => {
    const eliteExpiry = new Date();
    eliteExpiry.setHours(eliteExpiry.getHours() + 24);

    const { error } = await supabase
      .from('profiles')
      .update({ elite_until: eliteExpiry.toISOString() })
      .eq('id', userId);

    if (!error) {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#d7a94a', '#ffffff', '#000000']
      });
      onClose();
      window.location.reload(); 
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
  };

  const habits = [
    { title: "Break the Barrier", desc: lastWeekXP > 0 ? `Goal: ${Math.round(lastWeekXP * 1.15)} XP.` : "Reach 500 XP to unlock.", icon: <TrendingUp size={18} className="text-blue-400" /> },
    { title: "Shadow the Lead", desc: `Match last week's #1: ${winnerXP} XP.`, icon: <Trophy size={18} className="text-yellow-400" /> },
    { title: "Daily Sync", desc: "Earn XP today to verify.", icon: <ShieldCheck size={18} className="text-green-400" /> }
  ];

  const anyStarted = completed.some(v => v === true);
  const allDone = completed.every(v => v === true);

  return (
    <div onClick={handleOverlayClick} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020617]/95 backdrop-blur-xl cursor-pointer">
      <motion.div ref={modalRef} onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[56px] p-10 relative shadow-2xl overflow-hidden cursor-default">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
        <button onClick={onClose} className="absolute top-4 right-4 p-6 text-slate-600 hover:text-white transition-colors z-20"><X size={28}/></button>
        <div className="text-left space-y-2 mb-10 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-2">
            <Zap size={12} className="text-blue-400 fill-blue-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">System_Scan_Active</span>
          </div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">Pioneer_Coach</h2>
        </div>

        {loading ? ( <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div> ) : (
          <div className="space-y-3 relative z-10">
            {habits.map((habit, i) => (
              <div key={i} className={`p-6 rounded-[32px] border transition-all flex items-start gap-5 ${completed[i] ? 'bg-green-500/10 border-green-500/30' : 'bg-white/[0.03] border-white/5'}`}>
                <div className="shrink-0 mt-1">{completed[i] ? <CheckSquare size={20} className="text-green-400" /> : <Square size={20} className="text-slate-700" />}</div>
                <div className="text-left space-y-1">
                  <h4 className={`text-sm font-black uppercase tracking-widest italic ${completed[i] ? 'text-green-400' : 'text-white'}`}>{habit.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{habit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 relative z-10">
          {allDone ? (
            <button onClick={handleUnlockElite} className="w-full py-5 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-black uppercase italic rounded-3xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(215,169,74,0.4)]">
              <Sparkles size={18} /> ACTIVATE ELITE PROTOCOL
            </button>
          ) : (
            <button onClick={onClose} className={`w-full py-5 font-black uppercase italic rounded-3xl transition-all text-sm shadow-xl ${anyStarted ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
              {anyStarted ? "Continue Objective" : "Begin Objective"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}