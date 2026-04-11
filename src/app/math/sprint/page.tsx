"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Brain, Clock, CheckCircle2, XCircle, ChevronRight, Activity, Smile, Frown, Meh, Flame, Link 
} from "lucide-react";

type SprintPhase = 'mood' | 'countdown' | 'sprint' | 'results';

interface Question {
  num1: number;
  num2: number;
  operator: string;
  answer: number;
}

export default function DailySprintPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Phase Management
  const [phase, setPhase] = useState<SprintPhase>('mood');
  const [mood, setMood] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  
  // Sprint Mechanics
  const [timeLeft, setTimeLeft] = useState(60); // 60 Second Sprint
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Load User
  useEffect(() => {
    async function loadUser() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      setUserProfile(profile);
    }
    loadUser();
  }, [router]);

  // 2. Generate Random Question
  const generateQuestion = () => {
    const operators = ['+', '-', 'x', '÷'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let num1 = 0, num2 = 0, answer = 0;

    switch(operator) {
      case '+':
        num1 = Math.floor(Math.random() * 50) + 10;
        num2 = Math.floor(Math.random() * 50) + 10;
        answer = num1 + num2;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 50) + 20;
        num2 = Math.floor(Math.random() * (num1 - 5)) + 1; // Ensure positive result
        answer = num1 - num2;
        break;
      case 'x':
        num1 = Math.floor(Math.random() * 10) + 2;
        num2 = Math.floor(Math.random() * 10) + 2;
        answer = num1 * num2;
        break;
      case '÷':
        num2 = Math.floor(Math.random() * 10) + 2;
        answer = Math.floor(Math.random() * 10) + 2;
        num1 = num2 * answer; // Ensure clean division
        break;
    }

    setCurrentQuestion({ num1, num2, operator, answer });
    setUserAnswer("");
  };

  // 3. Countdown Timer Logic
  useEffect(() => {
    if (phase === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase('sprint');
        generateQuestion();
      }
    }
  }, [phase, countdown]);

  // 4. Sprint Timer Logic
  useEffect(() => {
    if (phase === 'sprint' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'sprint' && timeLeft === 0) {
      handleSprintComplete();
    }
  }, [phase, timeLeft]);

  // Keep focus on input during sprint
  useEffect(() => {
    if (phase === 'sprint' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, currentQuestion]);

  // 5. Handle Answer Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || !userAnswer) return;

    setTotalAttempts(prev => prev + 1);

    if (parseInt(userAnswer) === currentQuestion.answer) {
      setScore(prev => prev + 1);
      generateQuestion();
    } else {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setUserAnswer("");
      }, 400);
    }
  };

  // 6. Save Data to Supabase
  const handleSprintComplete = async () => {
    setPhase('results');
    setIsSaving(true);
    
    if (!userProfile) return;

    const accuracy = totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0;
    const earnedXP = score * 10; // 10 XP per correct answer
    const earnedSparks = score >= 10 ? 2 : 1; // 2 Sparks for high scores

    try {
      // Log the Sprint for Diagnostic Dashboard
      await supabase.from('math_daily_sprints').insert({
        student_id: userProfile.id,
        grade: 4, // Default to 4 if not set in metadata
        mood_emoji: mood || 'neutral',
        accuracy_pct: accuracy,
        speed_seconds: 60 - timeLeft
      });

      // Update Profile (XP & Sparks)
      await supabase.from('profiles').update({
        xp: (userProfile.xp || 0) + earnedXP,
        sparks: (userProfile.sparks || 0) + earnedSparks
      }).eq('id', userProfile.id);

      // Log XP transaction
      await supabase.from('xp_logs').insert({
        student_id: userProfile.id,
        amount: earnedXP,
        source: 'Math Daily Sprint',
        mission_id: 'SYSTEM_SPRINT'
      });

    } catch (err) {
      console.error("Failed to save sprint data", err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectMood = (selectedMood: string) => {
    setMood(selectedMood);
    setPhase('countdown');
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <AnimatePresence mode="wait">
        
        {/* PHASE 1: MOOD CHECK */}
        {phase === 'mood' && (
          <motion.div 
            key="mood"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-slate-200 rounded-[40px] p-10 max-w-lg w-full text-center shadow-2xl relative z-10"
          >
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Activity size={32} />
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Diagnostic Scan</h1>
            <p className="text-slate-500 font-medium mb-10">Before we begin the cognitive sprint, how are you feeling about your math logic today?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => selectMood('excited')} className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all group">
                <Smile size={32} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-600">Confident</span>
              </button>
              <button onClick={() => selectMood('neutral')} className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group">
                <Meh size={32} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-600">Okay</span>
              </button>
              <button onClick={() => selectMood('anxious')} className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 transition-all group">
                <Frown size={32} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-600">Anxious</span>
              </button>
              <button onClick={() => selectMood('frustrated')} className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all group">
                <Activity size={32} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-600">Frustrated</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* PHASE 2: COUNTDOWN */}
        {phase === 'countdown' && (
          <motion.div 
            key="countdown"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
            className="flex flex-col items-center justify-center relative z-10"
          >
            <h2 className="text-xl font-black text-blue-600 uppercase tracking-[0.3em] mb-8">Prepare for Uplink</h2>
            <div className="text-[12rem] font-black italic text-slate-900 leading-none tabular-nums tracking-tighter drop-shadow-2xl">
              {countdown}
            </div>
          </motion.div>
        )}

        {/* PHASE 3: THE SPRINT */}
        {phase === 'sprint' && currentQuestion && (
          <motion.div 
            key="sprint"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full max-w-3xl relative z-10"
          >
            <div className="flex justify-between items-center mb-10 px-4">
              <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                <Clock className={timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-blue-500"} size={24} />
                <span className={`text-2xl font-black tabular-nums ${timeLeft <= 10 ? "text-rose-600" : "text-slate-900"}`}>00:{timeLeft.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</span>
                <span className="text-2xl font-black tabular-nums text-emerald-500">{score}</span>
              </div>
            </div>

            <motion.div 
              animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`bg-white rounded-[48px] p-12 md:p-20 shadow-2xl border-4 flex flex-col items-center transition-colors ${isError ? 'border-rose-500 bg-rose-50' : 'border-blue-600'}`}
            >
              <div className="flex items-center justify-center gap-6 text-6xl md:text-8xl font-black italic tracking-tighter text-slate-900 mb-12">
                <span>{currentQuestion.num1}</span>
                <span className="text-blue-500">{currentQuestion.operator}</span>
                <span>{currentQuestion.num2}</span>
                <span className="text-slate-300">=</span>
              </div>
              
              <form onSubmit={handleSubmit} className="w-full max-w-xs">
                <input
                  ref={inputRef}
                  type="number"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-3xl py-6 text-center text-5xl font-black outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                  placeholder="?"
                  autoFocus
                  autoComplete="off"
                />
              </form>
            </motion.div>
            
            <p className="text-center text-slate-400 font-black uppercase tracking-widest text-[10px] mt-8">Press Enter to Submit</p>
          </motion.div>
        )}

        {/* PHASE 4: RESULTS */}
        {phase === 'results' && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-[40px] p-10 max-w-lg w-full text-center shadow-2xl relative z-10"
          >
            {isSaving ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <Clock className="animate-spin text-blue-500" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Diagnostics...</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
                  <CheckCircle2 size={40} />
                </div>
                <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Sprint Complete</h1>
                <p className="text-slate-500 font-medium mb-10">Cognitive calibration successful.</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Solved</p>
                    <p className="text-3xl font-black text-slate-900">{score}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Accuracy</p>
                    <p className="text-3xl font-black text-blue-600">{totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0}%</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 mb-10 flex items-center justify-between text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/60 mb-1">Rewards Authorized</p>
                    <p className="text-lg font-black text-amber-600">+{score * 10} XP | +{score >= 10 ? 2 : 1} Sparks</p>
                  </div>
                  <Zap size={32} className="text-amber-500" fill="currentColor" />
                </div>

                <button 
                    onClick={() => router.push('/math')}
                    className="flex items-center justify-center gap-3 w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors shadow-xl shadow-blue-200"
                >
                    Return to Quest Map <ChevronRight size={16} />
                </button>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </main>
  );
}