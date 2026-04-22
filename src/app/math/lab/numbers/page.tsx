"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Brain, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, Loader2, AlertCircle, HelpCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function NumbersLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Adaptive Engine State
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);
  
  // Interactive State
  const [numerator, setNumerator] = useState(0);
  const [denominator, setDenominator] = useState(1); 
  
  // UI Flow State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const pickRandomFromPool = useCallback((questions: any[], level: number) => {
    const pool = questions.filter(q => q.difficulty_level === level);
    const selected = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)] 
      : questions[Math.floor(Math.random() * questions.length)];

    if (selected) {
      const config = typeof selected.config === 'string' ? JSON.parse(selected.config) : selected.config;
      setDenominator(config.requiredDen || 1);
      setNumerator(0);
      setShowHint(false); // Reset hint for new question
    }
    return selected;
  }, []);

  useEffect(() => {
    async function initializeLab() {
      try {
        setLoading(true);
        const sessionData = localStorage.getItem("pioneer_session");
        if (sessionData) {
          const localUser = JSON.parse(sessionData);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
          setUserProfile(profile);
        }

        const { data, error } = await supabase.from('math_lab_questions').select('*').eq('sector', 'numbers');
        if (error) throw error;

        if (data && data.length > 0) {
          const shuffledData = [...data].sort(() => Math.random() - 0.5);
          setAllQuestions(shuffledData);
          setActiveQuestion(pickRandomFromPool(shuffledData, 3));
        } else {
          setDbError("No fraction directives found.");
        }
      } catch (err: any) {
        setDbError(err.message || "Logic core sync failed.");
      } finally {
        setLoading(false);
      }
    }
    initializeLab();
  }, [pickRandomFromPool]);

  const handleVerify = async () => {
    if (!activeQuestion) return;
    setIsProcessing(true);
    const config = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
    
    const isEquivalent = (numerator * config.targetDen) === (config.targetNum * denominator);

    // Simulated processing delay
    setTimeout(async () => {
      setIsProcessing(false);
      
      if (isEquivalent) {
        setIsSuccess(true);
        if (userProfile) {
          await supabase.from('profiles').update({
            xp: (userProfile.xp || 0) + (activeQuestion.xp_reward || 50),
            sparks: (userProfile.sparks || 0) + (activeQuestion.sparks_reward || 2)
          }).eq('id', userProfile.id);
        }

        // Adaptive Scale Up
        setTimeout(() => {
          setIsSuccess(false);
          const nextDifficulty = Math.min(5, currentDifficulty + 1);
          setCurrentDifficulty(nextDifficulty);
          setActiveQuestion(pickRandomFromPool(allQuestions, nextDifficulty));
        }, 2000);
      } else {
        // TRIGGER FAILURE OVERLAY
        setIsFailed(true);
      }
    }, 1000);
  };

  // NEW: Manual continue after reading the explanation
  const handleFailContinue = () => {
    setIsFailed(false);
    const nextDifficulty = Math.max(1, currentDifficulty - 1); // Scale down
    setCurrentDifficulty(nextDifficulty);
    setActiveQuestion(pickRandomFromPool(allQuestions, nextDifficulty));
  };

  if (loading || !activeQuestion) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading_Fractions</span>
      </div>
    </div>
  );

  const currentConfig = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
  const multiplier = currentConfig.requiredDen / currentConfig.targetDen;
  const correctNum = currentConfig.targetNum * multiplier;

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: (userProfile?.xp || 0) >= 1000 ? 2 : 1, currentLevel: { name: "Fraction Master", code: "MTH-NUM", accentColor: "#3b82f6", floor: 0 }, nextLevel: { name: "Math Lead", xpRequired: 1000 } }}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 hover:text-blue-600 transition-colors"><ArrowLeft size={14} /> Quest Map</Link>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Fraction_<span className="text-blue-600">Slicer</span></h1>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Adaptive Mode // Difficulty: {currentDifficulty}</p>
            </div>
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Balance</p>
                  <p className="text-xl font-black text-amber-500 italic leading-none">{userProfile?.sparks || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                  <Zap size={20} fill="currentColor" />
                </div>
            </div>
          </header>

          <div className="bg-white border-2 border-blue-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <AnimatePresence>
              {/* SUCCESS OVERLAY */}
              {isSuccess && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce"><CheckCircle2 size={40} /></div>
                  <h2 className="text-3xl font-black uppercase italic text-emerald-600">Logic Validated!</h2>
                  <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Scaling Difficulty Up (+1)...</p>
                </motion.div>
              )}

              {/* FAILURE & LEARNING OVERLAY */}
              {isFailed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-lg mb-6">
                    <AlertCircle size={40} />
                  </div>
                  
                  <h2 className="text-3xl font-black uppercase italic text-rose-600 mb-2">Logic Error</h2>
                  
                  <div className="max-w-md bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 mt-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">System Analysis:</p>
                    <p className="text-lg text-slate-700 leading-relaxed">
                      To find the equivalent fraction, look at how the denominator changed. <br/><br/>
                      It was multiplied by <span className="font-black text-blue-600">{multiplier}</span>. <br/>
                      Therefore, you must multiply the top number by <span className="font-black text-blue-600">{multiplier}</span> as well to get <span className="font-black text-emerald-600">{correctNum}</span>.
                    </p>
                  </div>

                  <button 
                    onClick={handleFailContinue}
                    className="mt-8 px-10 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-colors active:scale-95 flex items-center gap-2"
                  >
                    <RefreshCcw size={18} /> Rebuild Logic & Continue
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-2xl mx-auto space-y-10">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Cognitive: {activeQuestion.cognitive_level}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
                  {activeQuestion.prompt}
                </h2>
              </div>

              {/* THE LEARNING INTERFACE */}
              <div className="flex justify-center items-center gap-8 py-6">
                 {/* Original Fraction */}
                 <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-slate-400 uppercase mb-2">Target</span>
                    <div className="flex flex-col items-center border-2 border-slate-200 rounded-2xl p-4 bg-slate-50 min-w-[80px]">
                       <span className="text-3xl font-black text-slate-800">{currentConfig.targetNum}</span>
                       <div className="w-10 h-1 bg-slate-300 my-1" />
                       <span className="text-3xl font-black text-slate-800">{currentConfig.targetDen}</span>
                    </div>
                 </div>

                 <div className="text-2xl font-black text-blue-500 italic">=</div>

                 {/* New Fraction (Student Input) */}
                 <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-blue-500 uppercase mb-2">Your Logic</span>
                    <div className="flex flex-col items-center border-4 border-blue-500 rounded-2xl p-4 bg-blue-50 min-w-[80px] shadow-lg shadow-blue-100 transition-all">
                       <span className={`text-4xl font-black ${numerator > 0 ? 'text-blue-600' : 'text-blue-300 animate-pulse'}`}>{numerator || "?"}</span>
                       <div className="w-12 h-1.5 bg-blue-200 my-1" />
                       <span className="text-3xl font-black text-slate-400">{denominator}</span>
                    </div>
                 </div>
              </div>

              {/* VISUALIZER - NO CHEAT LINES */}
              <div className="space-y-4">
                <div className="relative h-16 w-full bg-slate-100 rounded-2xl border-2 border-slate-200 overflow-hidden flex">
                  {Array.from({ length: denominator }).map((_, i) => (
                    <motion.div 
                      key={i}
                      onClick={() => setNumerator(i + 1)}
                      className={`flex-1 border-r border-white/30 cursor-pointer transition-colors duration-200 ${i < numerator ? 'bg-blue-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]' : 'bg-transparent hover:bg-blue-50'}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 px-1 tracking-widest">
                  <span>Zero</span>
                  <span>{numerator} of {denominator} Slices Selected</span>
                  <span>One Whole</span>
                </div>
              </div>

              {/* HINT SYSTEM (Pre-Verification) */}
              <AnimatePresence>
                {showHint && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-blue-800 text-sm font-bold flex items-start gap-3 overflow-hidden">
                    <HelpCircle className="shrink-0 text-blue-500" size={20} />
                    <p>
                      Think: To get from <span className="underline">{currentConfig.targetDen}</span> to <span className="underline">{currentConfig.requiredDen}</span>, you must multiply by <span className="text-lg font-black">{multiplier}</span>. 
                      <br/>What is <span className="underline">{currentConfig.targetNum}</span> multiplied by <span className="text-lg font-black">{multiplier}</span>?
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={handleVerify}
                  disabled={isProcessing || numerator === 0}
                  className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase italic tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isProcessing ? <RefreshCcw className="animate-spin" /> : <Sparkles />} Verify My Logic
                </button>
                <button 
                  onClick={() => setShowHint(!showHint)} 
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showHint ? "Hide Hint" : "Need a hint?"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}