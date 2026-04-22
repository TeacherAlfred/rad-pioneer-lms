"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Clock, CheckCircle2, ChevronRight, Brain, Smile, Frown, Meh, Target, Trophy, Loader2, ArrowRight
} from "lucide-react";
import { MATH_BANK, MathQuestion } from "@/lib/mathDatabase";

type SprintPhase = 'mood' | 'countdown' | 'sprint' | 'results';

export default function DailySprintPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Game State
  const [phase, setPhase] = useState<SprintPhase>('mood');
  const [mood, setMood] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // Adaptive Engine State
  const [currentDifficulty, setCurrentDifficulty] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<MathQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  
  // UI State
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

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

  // SMART ADAPTIVE QUESTION GENERATOR
  const generateQuestion = useCallback((difficultyLevel: number) => {
    // Filter bank to find questions matching the target difficulty
    const availableQuestions = MATH_BANK.filter(q => q.level === difficultyLevel);
    
    // Fallback if something goes wrong (e.g. asking for level 6)
    if (availableQuestions.length === 0) {
       const fallback = MATH_BANK.filter(q => q.level === 5);
       setCurrentQuestion(fallback[Math.floor(Math.random() * fallback.length)]);
       return;
    }

    // Pick a random question from that difficulty pool
    const nextQ = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    
    // Shuffle the options so the answer isn't always in the same place
    const shuffledOptions = [...nextQ.options].sort(() => Math.random() - 0.5);
    
    setCurrentQuestion({ ...nextQ, options: shuffledOptions });
    setSelectedOption(null);
  }, []);

  const handleAnswerSubmit = (chosenAnswer: string) => {
    if (!currentQuestion) return;

    setSelectedOption(chosenAnswer);
    setTotalAttempts(prev => prev + 1);

    if (chosenAnswer === currentQuestion.answer) {
      // CORRECT: Increase score based on difficulty multiplier, bump difficulty up (max 5)
      setScore(prev => prev + currentQuestion.level);
      const newDifficulty = Math.min(5, currentDifficulty + 1);
      setCurrentDifficulty(newDifficulty);
      
      setTimeout(() => {
        generateQuestion(newDifficulty);
      }, 500);

    } else {
      // INCORRECT: Drop difficulty down to rebuild confidence (min 1)
      setIsError(true);
      const newDifficulty = Math.max(1, currentDifficulty - 1);
      setCurrentDifficulty(newDifficulty);
      
      setTimeout(() => {
        setIsError(false);
        generateQuestion(newDifficulty);
      }, 800);
    }
  };

  useEffect(() => {
    if (phase === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase('sprint');
        generateQuestion(currentDifficulty); // Start at level 1
      }
    }
  }, [phase, countdown, generateQuestion, currentDifficulty]);

  useEffect(() => {
    if (phase === 'sprint' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'sprint' && timeLeft === 0) {
      handleSprintComplete();
    }
  }, [phase, timeLeft]);

  const handleSprintComplete = async () => {
    setPhase('results');
    setIsSaving(true);
    if (!userProfile) return;
    
    const accuracy = totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0;
    const earnedXP = score * 10;
    const earnedSparks = score >= 10 ? 2 : 1;
    
    try {
      await supabase.from('math_daily_sprints').insert({
        student_id: userProfile.id,
        grade: userProfile.metadata?.grade || 5,
        mood_emoji: mood || 'neutral',
        accuracy_pct: accuracy,
        speed_seconds: 60
      });
      await supabase.from('profiles').update({
        xp: (userProfile.xp || 0) + earnedXP,
        sparks: (userProfile.sparks || 0) + earnedSparks
      }).eq('id', userProfile.id);
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const w = 340; const h = 440; const r = 60;
  const pathData = `M${r},4 H${w-r} A${r-4},${r-4} 0 0 1 ${w-4},${r} V${h-r} A${r-4},${r-4} 0 0 1 ${w-r},${h-4} H${r} A${r-4},${r-4} 0 0 1 4,${h-r} V${r} A${r-4},${r-4} 0 0 1 ${r},4`;
  const totalLen = 1350; 

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.4] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <AnimatePresence mode="wait">
        {/* MOOD PHASE */}
        {phase === 'mood' && (
          <motion.div key="mood" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white/80 backdrop-blur-2xl border border-white rounded-[48px] p-8 md:p-12 max-w-lg w-full text-center shadow-xl relative z-10">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-blue-100 shadow-inner"><Brain size={40} /></div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-3 leading-none text-slate-900">Brain <span className="text-blue-600">Check</span></h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-10">How are you feeling today?</p>
            <div className="grid grid-cols-2 gap-4">
              {[{ id: 'excited', icon: Smile, label: 'Ready!' }, { id: 'neutral', icon: Meh, label: 'Okay' }, { id: 'anxious', icon: Frown, label: 'Nervous' }, { id: 'frustrated', icon: Zap, label: 'Tired' }].map((m) => (
                <button key={m.id} onClick={() => { setMood(m.id); setPhase('countdown'); }} className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:border-blue-300 hover:shadow-lg transition-all group">
                  <m.icon size={32} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">{m.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* COUNTDOWN PHASE */}
        {phase === 'countdown' && (
          <motion.div key="countdown" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="flex flex-col items-center justify-center relative z-10">
            <p className="text-blue-600 font-black uppercase tracking-[0.5em] text-xs mb-4">Starting Sprint</p>
            <div className="text-[12rem] md:text-[15rem] font-black italic text-slate-900 leading-none tracking-tighter">{countdown}</div>
          </motion.div>
        )}

        {/* ACTIVE SPRINT PHASE */}
        {phase === 'sprint' && currentQuestion && (
          <motion.div key="sprint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl relative z-10 px-4">
            
            {/* Header HUD */}
            <div className="flex justify-between items-center mb-6 md:mb-10">
              <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white shadow-sm">
                <Clock className={timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-blue-600"} size={18} />
                <span className={`text-lg font-black tabular-nums leading-none ${timeLeft <= 10 ? "text-rose-600" : "text-slate-900"}`}>00:{timeLeft.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex flex-col items-center justify-center">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">Level {currentDifficulty}</span>
              </div>
              <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white shadow-sm">
                <span className="text-lg font-black tabular-nums text-emerald-600 leading-none">{score} PTS</span>
                <Target size={18} className="text-emerald-600" />
              </div>
            </div>

            {/* Main Question Card */}
            <motion.div animate={isError ? { x: [-8, 8, -8, 8, 0] } : {}} className={`bg-white rounded-[48px] p-8 md:p-12 border ${isError ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'} flex flex-col items-center shadow-[0_25px_60px_rgba(0,0,0,0.04)] relative z-10 w-full text-center`}>
              
              <div className="mb-10 space-y-4">
                 <span className="inline-flex text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-md">{currentQuestion.sector}</span>
                 <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter text-slate-900 leading-tight">
                   {currentQuestion.question}
                 </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                 {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const isCorrectAnswer = opt === currentQuestion.answer;
                    
                    let btnClass = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200";
                    if (isSelected && isCorrectAnswer) btnClass = "bg-emerald-500 border-emerald-600 text-white shadow-lg";
                    if (isSelected && !isCorrectAnswer) btnClass = "bg-rose-500 border-rose-600 text-white shadow-lg";

                    return (
                      <button 
                        key={idx}
                        onClick={() => handleAnswerSubmit(opt)}
                        disabled={selectedOption !== null}
                        className={`w-full py-5 md:py-6 rounded-2xl border-2 text-xl font-black transition-all ${btnClass}`}
                      >
                        {opt}
                      </button>
                    )
                 })}
              </div>

            </motion.div>
          </motion.div>
        )}

        {/* RESULTS PHASE */}
        {phase === 'results' && (
          <motion.div key="results" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white/70 backdrop-blur-3xl border border-white rounded-[60px] p-8 md:p-14 max-w-lg w-full text-center shadow-2xl relative z-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-to-b from-blue-400/5 to-transparent -z-10" />
            {isSaving ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-8">
                <Loader2 className="animate-spin text-blue-600" size={60} />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Saving Results</p>
              </div>
            ) : (
              <>
                <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 15 }} className="relative w-28 h-28 md:w-32 md:h-32 mx-auto mb-8 md:mb-10">
                  <div className="absolute inset-0 bg-emerald-400/20 blur-3xl rounded-full animate-pulse" />
                  <div className="relative w-full h-full rounded-[44px] bg-white border border-slate-100 shadow flex items-center justify-center">
                    <Trophy size={56} className="text-emerald-500" strokeWidth={1.5} />
                  </div>
                </motion.div>
                <div className="space-y-1 mb-10 md:mb-12">
                  <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-slate-900 leading-[0.8]">Sprint <span className="text-blue-600">Done!</span></h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Great Job!</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8 md:mb-10">
                  <div className="p-4 md:p-6 rounded-[28px] md:rounded-[36px] bg-slate-50/50 border border-white shadow-inner">
                    <div className="flex items-center justify-center gap-2 mb-2 md:mb-3 text-slate-400"><CheckCircle2 size={12} /><span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Score</span></div>
                    <p className="text-4xl md:text-5xl font-black text-slate-900 italic tracking-tighter">{score}</p>
                  </div>
                  <div className="p-4 md:p-6 rounded-[28px] md:rounded-[36px] bg-slate-50/50 border border-white shadow-inner">
                    <div className="flex items-center justify-center gap-2 mb-2 md:mb-3 text-slate-400"><Target size={12} /><span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Accuracy</span></div>
                    <p className="text-4xl md:text-5xl font-black text-blue-600 italic tracking-tighter">{totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0}%</p>
                  </div>
                </div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="relative bg-gradient-to-br from-amber-400 to-orange-500 rounded-[40px] p-6 md:p-8 flex items-center justify-between mb-10 md:mb-12 shadow-xl">
                  <div className="text-left relative z-10 text-white">
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Your Prizes</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl md:text-4xl font-black italic tracking-tighter">+{score * 10}</span><span className="text-[10px] font-black uppercase">XP</span>
                      <div className="h-4 w-px bg-white/20 mx-1" />
                      <span className="text-3xl md:text-4xl font-black italic tracking-tighter">+{score >= 10 ? 2 : 1}</span><span className="text-[10px] font-black uppercase">Sparks</span>
                    </div>
                  </div>
                  <Zap size={40} className="text-white fill-white" />
                </motion.div>
                <button onClick={() => router.push('/math')} className="group w-full py-5 md:py-7 bg-slate-900 text-white rounded-[24px] md:rounded-[30px] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs flex items-center justify-center gap-3 transition-all hover:bg-blue-600 shadow-xl">Go Back <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}