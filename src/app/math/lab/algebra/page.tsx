"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Settings, ArrowRight, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AlgebraLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Adaptive Engine State
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3); // Start at Average
  
  // Interactive States
  const [userOutput, setUserOutput] = useState<string>("");
  const [userOp, setUserOp] = useState<string>("+");
  const [userVal, setUserVal] = useState<string>("");
  
  // UI Flow State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [machineAnimating, setMachineAnimating] = useState(false);

  // HELPER: Pick a random question from a specific difficulty pool and reset the machine
  const pickRandomFromPool = useCallback((questions: any[], level: number) => {
    const pool = questions.filter(q => q.difficulty_level === level);
    const selected = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)] 
      : questions[Math.floor(Math.random() * questions.length)];

    if (selected) {
      // RESET MACHINE INPUTS
      setUserOutput("");
      setUserVal("");
      setUserOp("+");
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

        // Fetch all Algebra questions
        const { data, error } = await supabase
          .from('math_lab_questions')
          .select('*')
          .eq('sector', 'algebra');

        if (error) throw error;

        if (data && data.length > 0) {
          // SHUFFLE the initial data so Ctl+R provides a fresh start
          const shuffledData = [...data].sort(() => Math.random() - 0.5);
          setAllQuestions(shuffledData);
          setActiveQuestion(pickRandomFromPool(shuffledData, 3)); // Start with Average
        } else {
          setDbError("No logic protocols found in the database.");
        }
      } catch (err: any) {
        setDbError(err.message || "Failed to link with Rule Machine.");
      } finally {
        setLoading(false);
      }
    }
    initializeLab();
  }, [pickRandomFromPool]);

  const handleVerify = async () => {
    if (!activeQuestion) return;
    setIsProcessing(true);
    setMachineAnimating(true);
    
    const config = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
    
    let isCorrect = false;
    if (config.type === 'find_output') {
      isCorrect = parseInt(userOutput) === config.output;
    } else {
      isCorrect = userOp === config.ruleOp && parseInt(userVal) === config.ruleVal;
    }

    // Processing Delay for visual effect
    setTimeout(async () => {
      setMachineAnimating(false);
      setIsProcessing(false);
      
      if (isCorrect) {
        setIsSuccess(true);
        if (userProfile) {
          await supabase.from('profiles').update({ 
            xp: (userProfile.xp || 0) + (activeQuestion.xp_reward || 50), 
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

  // NEW: Manual continue after reading the explanation
  const handleFailContinue = () => {
    setIsFailed(false);
    const nextDifficulty = Math.max(1, currentDifficulty - 1); // Scale down
    setCurrentDifficulty(nextDifficulty);
    setActiveQuestion(pickRandomFromPool(allQuestions, nextDifficulty));
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-purple-600" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Booting_Logic_Core</span>
      </div>
    </div>
  );

  if (dbError) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-center p-6">
       <AlertCircle size={64} className="text-amber-500 mb-4" />
       <h1 className="text-2xl font-black uppercase italic text-slate-900">Machine_Offline</h1>
       <p className="text-slate-500 mb-8">{dbError}</p>
       <Link href="/math" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Return to Map</Link>
    </div>
  );

  const activeConfig = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;

  // Helper to calculate the correct output for explanations
  const getCorrectOutput = () => {
    if (activeConfig.ruleOp === '+') return activeConfig.input + activeConfig.ruleVal;
    if (activeConfig.ruleOp === '-') return activeConfig.input - activeConfig.ruleVal;
    if (activeConfig.ruleOp === '×') return activeConfig.input * activeConfig.ruleVal;
    if (activeConfig.ruleOp === '÷') return activeConfig.input / activeConfig.ruleVal;
    return 0;
  };

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: (userProfile?.xp || 0) >= 1000 ? 2 : 1, currentLevel: { name: "Algebra Ace", code: "MTH-ALG", accentColor: "#9333ea", floor: 0 }, nextLevel: { name: "Math Lead", xpRequired: 1000 } }}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="text-[10px] font-black uppercase text-slate-400 hover:text-purple-600 flex items-center gap-2 transition-colors"><ArrowLeft size={14}/> Quest Map</Link>
              <h1 className="text-3xl font-black uppercase italic text-slate-900">The_Rule_<span className="text-purple-600">Machine</span></h1>
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mt-1">Adaptive Protocol // Difficulty: {currentDifficulty}</p>
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

          <div className="bg-white border-2 border-purple-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <AnimatePresence>
                {/* SUCCESS OVERLAY */}
                {isSuccess && ( 
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-3xl font-black uppercase italic text-emerald-600">Logic Validated!</h2>
                        <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Calibrating Next Protocol (+1)...</p>
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
                      
                      {activeConfig.type === 'find_output' ? (
                        <p className="text-lg text-slate-700 leading-relaxed">
                          The machine's rule is <span className="font-black text-purple-600">{activeConfig.ruleOp} {activeConfig.ruleVal}</span>.<br/><br/>
                          If the input is <span className="font-black text-slate-800">{activeConfig.input}</span>, the math is:<br/>
                          <span className="inline-block mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-black text-xl">
                            {activeConfig.input} {activeConfig.ruleOp} {activeConfig.ruleVal} = {getCorrectOutput()}
                          </span>
                        </p>
                      ) : (
                        <p className="text-lg text-slate-700 leading-relaxed">
                          The input was <span className="font-black text-slate-800">{activeConfig.input}</span> and the output was <span className="font-black text-emerald-600">{activeConfig.output}</span>.<br/><br/>
                          The only rule that connects these numbers is:<br/>
                          <span className="inline-block mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-black text-xl">
                            {activeConfig.ruleOp} {activeConfig.ruleVal}
                          </span>
                          <br/><span className="text-sm font-bold text-slate-400 mt-2 block">(Because {activeConfig.input} {activeConfig.ruleOp} {activeConfig.ruleVal} = {activeConfig.output})</span>
                        </p>
                      )}
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
            
            <div className="max-w-3xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 text-purple-600 rounded-xl text-xs font-black uppercase tracking-widest">
                    <Shield size={14} /> Cognitive: {activeQuestion.cognitive_level}
                </div>
                <h2 className="text-2xl md:text-3xl font-medium text-slate-700 leading-relaxed">
                    {activeQuestion.prompt}
                </h2>
              </div>

              <div className="relative py-12">
                <div className="absolute top-1/2 left-0 w-full h-4 bg-slate-200 -translate-y-1/2 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-purple-400 w-1/3" initial={{ x: '-100%' }} animate={machineAnimating ? { x: ['-100%', '300%'] } : { x: '-100%' }} transition={{ duration: 1.5, ease: "linear" }} />
                </div>

                <div className="grid grid-cols-3 gap-4 items-center relative z-10">
                  {/* Input Block */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Input</span>
                    <div className="w-24 h-24 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-4xl font-black text-slate-800">{activeConfig.input}</span>
                    </div>
                  </div>

                  {/* Core Processing Block */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-purple-500 tracking-widest">Rule_Core</span>
                    <div className="w-32 h-32 bg-purple-600 rounded-[32px] flex items-center justify-center shadow-xl border-4 border-purple-400 relative overflow-hidden">
                      <Settings className={`absolute opacity-20 text-white w-48 h-48 ${machineAnimating ? 'animate-spin' : ''}`} style={{ transition: 'transform 0.5s ease-in-out' }} />
                      <div className="relative z-10 text-white font-black text-2xl">
                        {activeConfig.type === 'find_output' ? (
                            <span className="bg-purple-800/40 px-3 py-1 rounded-lg backdrop-blur-sm">{activeConfig.ruleOp} {activeConfig.ruleVal}</span>
                        ) : (
                          <div className="flex items-center gap-1 bg-purple-800/50 p-2 rounded-xl backdrop-blur-sm">
                            <select value={userOp} onChange={(e) => setUserOp(e.target.value)} disabled={isProcessing} className="bg-transparent outline-none cursor-pointer appearance-none text-center min-w-[30px]">
                              <option value="+" className="text-black">+</option>
                              <option value="-" className="text-black">-</option>
                              <option value="×" className="text-black">×</option>
                              <option value="÷" className="text-black">÷</option>
                            </select>
                            <input type="number" value={userVal} onChange={(e) => setUserVal(e.target.value)} disabled={isProcessing} className="w-12 bg-transparent border-b-2 border-white/30 text-center outline-none focus:border-white transition-colors" placeholder="?" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Output Block */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Output</span>
                    <div className="w-24 h-24 bg-white border-4 border-emerald-400 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {activeConfig.type === 'find_rule' ? (
                          <span className="text-4xl font-black text-slate-800">{activeConfig.output}</span>
                      ) : (
                        <input type="number" value={userOutput} onChange={(e) => setUserOutput(e.target.value)} disabled={isProcessing} className="w-full text-center text-4xl font-black text-emerald-600 outline-none bg-transparent placeholder:text-emerald-100" placeholder="?" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleVerify} 
                  disabled={isProcessing || (activeConfig.type === 'find_output' ? !userOutput : !userVal)} 
                  className="px-12 py-5 bg-purple-600 text-white rounded-[24px] font-black uppercase italic tracking-widest shadow-xl flex items-center gap-3 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Engage Machine
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