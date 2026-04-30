"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Ruler, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Settings2, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateEventXp } from "@/lib/xp-engine";

export default function MeasurementLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Adaptive Engine State
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3); // Start at Average
  
  // Interactive Gearbox State
  const [userOp, setUserOp] = useState<string>("×");
  const [userMag, setUserMag] = useState<number>(10);
  
  // UI Flow State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gearboxAnimating, setGearboxAnimating] = useState(false);

  // HELPER: Pick random question and reset gearbox
  const pickRandomFromPool = useCallback((questions: any[], level: number) => {
    const pool = questions.filter(q => q.difficulty_level === level);
    const selected = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)] 
      : questions[Math.floor(Math.random() * questions.length)];

    if (selected) {
      setUserOp("×");
      setUserMag(10);
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

        const { data, error } = await supabase
          .from('math_lab_questions')
          .select('*')
          .eq('sector', 'measurement');

        if (error) throw error;

        if (data && data.length > 0) {
          // SHUFFLE data for true randomness on refresh
          const shuffledData = [...data].sort(() => Math.random() - 0.5);
          setAllQuestions(shuffledData);
          setActiveQuestion(pickRandomFromPool(shuffledData, 3)); // Start at Level 3
        } else {
          setDbError("No conversion blueprints found in the database.");
        }
      } catch (err: any) {
        setDbError(err.message || "Failed to link with conversion core.");
      } finally {
        setLoading(false);
      }
    }
    initializeLab();
  }, [pickRandomFromPool]);

  const handleVerify = async () => {
    if (!activeQuestion) return;
    setIsProcessing(true);
    setGearboxAnimating(true);
    
    const config = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
    const isCorrect = userOp === config.targetOp && userMag === config.targetMag;

    setTimeout(async () => {
      setGearboxAnimating(false);
      setIsProcessing(false); // Stop the loading spinner
      
      if (isCorrect) {
        setIsSuccess(true);
        
        if (userProfile) {
          // Calculate the multiplied XP safely
          const finalXp = await calculateEventXp(activeQuestion.xp_reward || 50);

          await supabase.from('profiles').update({ 
            xp: (userProfile.xp || 0) + finalXp, 
            sparks: (userProfile.sparks || 0) + (activeQuestion.sparks_reward || 2) 
          }).eq('id', userProfile.id);
        }

        // ADAPTIVE STEP UP
        setTimeout(() => {
          setIsSuccess(false);
          const nextLevel = Math.min(5, currentDifficulty + 1);
          setCurrentDifficulty(nextLevel);
          setActiveQuestion(pickRandomFromPool(allQuestions, nextLevel));
        }, 2000);

      } else {
        // TRIGGER FAILURE OVERLAY
        setIsFailed(true);
      }
    }, 1500); 
  };

  // NEW FUNCTION: Triggered when the student clicks "Continue" on the fail screen
  const handleFailContinue = () => {
    setIsFailed(false);
    const nextDifficulty = Math.max(1, currentDifficulty - 1); // Scale down
    setCurrentDifficulty(nextDifficulty);
    setActiveQuestion(pickRandomFromPool(allQuestions, nextDifficulty));
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Calibrating_Gearbox</span>
      </div>
    </div>
  );

  if (dbError) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-center p-6">
       <AlertCircle size={64} className="text-amber-500 mb-4" />
       <h1 className="text-2xl font-black uppercase italic text-slate-900">Gearbox_Offline</h1>
       <p className="text-slate-500 mb-8">{dbError}</p>
       <Link href="/math" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Return to Map</Link>
    </div>
  );

  const currentConfig = activeQuestion?.config ? (typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config) : null;
  const liveResult = currentConfig ? (userOp === '×' ? currentConfig.fromVal * userMag : currentConfig.fromVal / userMag) : 0;

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: (userProfile?.xp || 0) >= 1000 ? 2 : 1, currentLevel: { name: "Metric Master", code: "MTH-MEA", accentColor: "#10b981", floor: 0 }, nextLevel: { name: "Math Lead", xpRequired: 1000 } }}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="text-[10px] font-black uppercase text-slate-400 hover:text-emerald-600 flex items-center gap-2 transition-colors"><ArrowLeft size={14}/> Quest Map</Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-200 shadow-sm">
                  <Ruler size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic text-slate-900 leading-none">Conversion_<span className="text-emerald-600">Gearbox</span></h1>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Adaptive Mode // Difficulty: {currentDifficulty}</p>
                </div>
              </div>
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

          <div className="bg-white border-2 border-emerald-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <AnimatePresence>
              {isSuccess && ( 
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce"><CheckCircle2 size={40} /></div>
                  <h2 className="text-3xl font-black uppercase italic text-emerald-600">Calibration Verified!</h2>
                  <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Scaling Difficulty Up (+1)...</p>
                </motion.div> 
              )}
              {isFailed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-lg mb-6">
                    <AlertCircle size={40} />
                  </div>
                  
                  <h2 className="text-3xl font-black uppercase italic text-rose-600 mb-2">Calibration Error</h2>
                  
                  <div className="max-w-md bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 mt-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">System Analysis:</p>
                    <p className="text-lg text-slate-700 leading-relaxed">
                      To convert <span className="font-black text-slate-900">{currentConfig.fromUnit}</span> to an equivalent value, 
                      the correct gearbox logic is: <br/>
                      <span className="inline-block mt-3 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-black text-2xl">
                        {currentConfig.targetOp} {currentConfig.targetMag}
                      </span>
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
            
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Cognitive: {activeQuestion.cognitive_level}
                </div>
                <h2 className="text-2xl md:text-3xl font-medium text-slate-700 leading-relaxed">
                  {activeQuestion.prompt}
                </h2>
              </div>

              <div className="bg-slate-50 border-2 border-slate-200 rounded-[32px] p-8 md:p-12 relative">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                  
                  {/* INPUT DISPLAY */}
                  <div className="w-full md:w-40 bg-white border-4 border-slate-300 rounded-3xl p-6 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-[10px] font-black uppercase text-slate-400 mb-2">Input</span>
                    <span className="text-4xl font-black text-slate-800">{currentConfig.fromVal}</span>
                    <span className="text-[11px] font-black uppercase text-slate-500 mt-3 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200">{currentConfig.fromUnit}</span>
                  </div>

                  {/* GEARBOX CONTROLS */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Logic Core</span>
                    <div className={`flex items-center gap-2 bg-slate-800 p-2.5 rounded-2xl shadow-xl border-2 transition-colors ${gearboxAnimating ? 'border-emerald-500 shadow-emerald-500/20' : 'border-slate-700'}`}>
                      <div className="flex flex-col gap-1.5">
                        {['×', '÷'].map(op => (
                          <button 
                            key={op} 
                            onClick={() => setUserOp(op)} 
                            disabled={isProcessing}
                            className={`w-14 h-12 rounded-xl font-black text-2xl transition-all disabled:opacity-50 ${userOp === op ? 'bg-emerald-500 text-white shadow-inner' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                      
                      <div className="w-px h-20 bg-slate-600 mx-2" />
                      
                      <div className="flex flex-col gap-1.5">
                        {[10, 100, 1000].map(mag => (
                          <button 
                            key={mag} 
                            onClick={() => setUserMag(mag)} 
                            disabled={isProcessing}
                            className={`w-20 h-10 rounded-lg font-black text-base transition-all disabled:opacity-50 ${userMag === mag ? 'bg-blue-500 text-white shadow-inner' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                          >
                            {mag}
                          </button>
                        ))}
                      </div>
                    </div>
                    {gearboxAnimating && (
                      <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black animate-pulse uppercase tracking-widest mt-2">
                        <Settings2 size={14} className="animate-spin" /> Computing...
                      </div>
                    )}
                  </div>

                  {/* LIVE OUTPUT */}
                  <div className="w-full md:w-48 bg-emerald-50 border-4 border-emerald-400 rounded-3xl p-6 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-[10px] font-black uppercase text-emerald-600/60 mb-2 tracking-widest">Live Output</span>
                    <span className="text-4xl font-black text-emerald-600 break-all text-center">
                      {Number.isInteger(liveResult) ? liveResult : liveResult.toFixed(3).replace(/\.?0+$/, '')}
                    </span>
                  </div>

                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleVerify} 
                  disabled={isProcessing} 
                  className="px-14 py-6 bg-emerald-600 text-white rounded-[28px] font-black uppercase italic tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50 flex items-center gap-3"
                >
                  {isProcessing ? <RefreshCcw size={22} className="animate-spin" /> : <Sparkles size={22} />} Engage Conversion
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