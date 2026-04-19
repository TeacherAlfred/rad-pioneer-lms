"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, ShieldAlert, ArrowRight } from "lucide-react";
import AdaptiveLogicSprint from "@/components/lms/AdaptiveLogicSprint";
import { motion, AnimatePresence } from "framer-motion";

export default function ModuleCheckpointPage() {
  const params = useParams();
  const router = useRouter();
  
  const moduleId = (params?.module_id || params?.id) as string;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [sprintFinished, setSprintFinished] = useState(false);

  useEffect(() => {
    async function initCheckpoint() {
      try {
        if (!moduleId || moduleId === 'undefined') {
            throw new Error(`Routing Error: Missing Module ID in URL.`);
        }

        const sessionData = localStorage.getItem("pioneer_session");
        if (!sessionData) { router.push("/login"); return; }
        const localUser = JSON.parse(sessionData);
        setUser(localUser);

        const { data: qData, error: qErr } = await supabase
          .from('sprint_questions')
          .select('*')
          .eq('module_id', moduleId);

        if (qErr) throw new Error(`Database Error: ${qErr.message}`);
        if (!qData || qData.length === 0) throw new Error(`No uplink data found for Module ID: ${moduleId}`);
        
        setQuestions(qData);
        
      } catch (err: any) {
        console.error("Caught Error:", err);
        setErrorMsg(err?.message || "Failed to establish secure connection.");
      } finally {
        setLoading(false);
      }
    }
    
    initCheckpoint();
  }, [moduleId, router]);

  const handleSprintComplete = async (stats: { score: number, timeTaken: number, maxLevel: number, multiplier: number }) => {
    setIsSaving(true);
    try {
      const baseXP = 100;
      const earnedXP = baseXP * stats.multiplier;

      // 1. Fetch previous attempts to determine the next attempt_number
      const { data: existingAttempts, error: fetchErr } = await supabase
        .from('quiz_attempts')
        .select('attempt_number')
        .eq('student_id', user.id)
        .eq('module_id', moduleId)
        .order('attempt_number', { ascending: false });

      if (fetchErr) throw new Error(`Quiz Check Error: ${fetchErr.message}`);

      // Calculate the next attempt number (defaults to 1 if no previous attempts exist)
      const nextAttemptNumber = existingAttempts && existingAttempts.length > 0 
        ? (existingAttempts[0].attempt_number || existingAttempts.length) + 1 
        : 1;

      // 2. Insert the new attempt record with the correct attempt_number
      const { error: qaError } = await supabase.from('quiz_attempts').insert([{
        student_id: user.id,
        module_id: moduleId,
        score: stats.score,
        passed: true,
        time_taken: stats.timeTaken,
        attempt_number: nextAttemptNumber
      }]);

      if (qaError) throw new Error(`Quiz Save Error: ${qaError.message}`);

      // 3. Update User XP
      const newXp = (user.xp || 0) + earnedXP;
      const { error: profileError } = await supabase.from('profiles').update({ xp: newXp }).eq('id', user.id);
      
      if (profileError) throw new Error(`Profile Save Error: ${profileError.message}`);

      const updatedUser = { ...user, xp: newXp };
      localStorage.setItem("pioneer_session", JSON.stringify(updatedUser));

      setSprintFinished(true);
    } catch (err: any) {
      console.error("Failed to save results:", err);
      alert(`Results calculated, but failed to sync: ${err?.message || 'Unknown Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Initializing Matrix...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-900 space-y-6 px-6 text-center">
        <ShieldAlert size={64} className="text-rose-500" />
        <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest max-w-2xl text-slate-900">{errorMsg}</h1>
        <button onClick={() => router.push('/student/courses')} className="px-8 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-black uppercase text-xs transition-colors mt-4 shadow-lg">
          Abort Sequence
        </button>
      </div>
    );
  }

  return (
    <main className="h-[100dvh] bg-[#F8FAFC] text-slate-900 flex flex-col overflow-hidden relative selection:bg-blue-500/30 font-sans">
      
      {/* PLAYFUL AMBIENT BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.3]"
           style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Slow moving colorful orbs for energy */}
      <motion.div 
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }} 
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 blur-[100px] rounded-full pointer-events-none z-0" 
      />
      <motion.div 
        animate={{ y: [0, 30, 0], x: [0, -20, 0] }} 
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-400/20 blur-[120px] rounded-full pointer-events-none z-0" 
      />

      {/* TOP NAV: Frosted Glass */}
      <nav className="relative z-20 px-6 py-4 flex justify-between items-center shrink-0 bg-white/60 backdrop-blur-xl border-b border-white shadow-sm">
        <button 
          onClick={() => {
            if(window.confirm("Abort the sequence? Your progress will be lost.")) {
              router.push('/student/courses');
            }
          }} 
          className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-400 hover:shadow-md transition-all active:scale-95"
          title="Abort Sequence"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-right flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Live Environment</p>
        </div>
      </nav>

      {/* THE MATRIX ENGINE */}
      <div className="flex-1 relative z-10 w-full flex flex-col items-center justify-center p-4 md:p-8 pb-24">
        <AdaptiveLogicSprint 
          questions={questions} 
          onComplete={handleSprintComplete} 
        />

        {/* POST-GAME ACTION BAR */}
        <AnimatePresence>
          {sprintFinished && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
              className="absolute bottom-10 left-0 right-0 flex justify-center z-50"
            >
              <button 
                onClick={() => router.push('/student/courses')}
                disabled={isSaving}
                className="group flex items-center gap-3 px-10 py-5 bg-slate-900 hover:bg-blue-600 text-white rounded-full font-black uppercase tracking-widest text-[11px] transition-all shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:-translate-y-1 active:translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin"/> : "Claim XP & Return to Roadmap"}
                {!isSaving && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </main>
  );
}