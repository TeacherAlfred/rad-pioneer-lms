"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, BarChart, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Recycle, Database, FileText, Plus, Minus, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TALLY_ITEMS = [
  { id: 'plastic', label: 'Plastic', icon: Recycle, color: 'emerald' },
  { id: 'glass', label: 'Glass', icon: Database, color: 'amber' },
  { id: 'paper', label: 'Paper', icon: FileText, color: 'blue' }
];

export default function DataHandlingLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Adaptive Engine State
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3); // Start at Average

  const [tallies, setTallies] = useState<Record<string, number>>({ plastic: 0, glass: 0, paper: 0 });
  
  // UI Flow State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // HELPER: Pick a random question and clear the tally board
  const pickRandomFromPool = useCallback((questions: any[], level: number) => {
    const pool = questions.filter(q => q.difficulty_level === level);
    const selected = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)] 
      : questions[Math.floor(Math.random() * questions.length)];

    if (selected) {
      setTallies({ plastic: 0, glass: 0, paper: 0 });
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
          .eq('sector', 'data');

        if (error) throw error;

        if (data && data.length > 0) {
          // SHUFFLE data for true randomness on refresh
          const shuffledData = [...data].sort(() => Math.random() - 0.5);
          setAllQuestions(shuffledData);
          setActiveQuestion(pickRandomFromPool(shuffledData, 3)); // Start at Level 3
        } else {
          setDbError("No tally directives found in the database.");
        }
      } catch (err: any) {
        setDbError(err.message || "Failed to link with intelligence core.");
      } finally {
        setLoading(false);
      }
    }
    initializeLab();
  }, [pickRandomFromPool]);

  const updateTally = (id: string, delta: number) => {
    setTallies(prev => ({ ...prev, [id]: Math.max(0, Math.min(30, prev[id] + delta)) }));
  };

  const handleVerify = async () => {
    if (!activeQuestion) return;
    setIsProcessing(true);
    
    const config = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
    
    const isCorrect = TALLY_ITEMS.every(item => tallies[item.id] === (config.targets[item.id] || 0));

    // Simulated processing delay
    setTimeout(async () => {
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

  const TallyGroup = ({ count }: { count: number }) => {
    const fives = Math.floor(count / 5);
    const remainder = count % 5;
    return (
      <div className="flex flex-wrap gap-4 items-center min-h-[40px]">
        {Array.from({ length: fives }).map((_, i) => (
           <div key={i} className="relative w-8 h-10 flex justify-between items-center">
             {[...Array(4)].map((_, j) => <div key={j} className="w-1 h-full bg-slate-700 rounded-full" />)}
             <div className="absolute h-1 bg-slate-700 rounded-full rotate-[-45deg] w-[40px] top-1/2 -left-1" />
           </div>
        ))}
        {remainder > 0 && <div className="h-10 flex gap-1.5 items-center">{Array.from({ length: remainder }).map((_, i) => <div key={i} className="w-1 h-full bg-slate-700 rounded-full" />)}</div>}
      </div>
    );
  };

  if (loading || !activeQuestion) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading_Evidence</span>
      </div>
    </div>
  );

  if (dbError) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-center p-6">
       <AlertCircle size={64} className="text-amber-500 mb-4" />
       <h1 className="text-2xl font-black uppercase italic text-slate-900">Database_Offline</h1>
       <p className="text-slate-500 mb-8">{dbError}</p>
       <Link href="/math" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Return to Map</Link>
    </div>
  );

  const activeConfig = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
  const expectedTargets = activeConfig?.targets || {};

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: (userProfile?.xp || 0) >= 1000 ? 2 : 1, currentLevel: { name: "Data Detective", code: "MTH-DAT", accentColor: "#4f46e5", floor: 0 }, nextLevel: { name: "Math Lead", xpRequired: 1000 } }}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition-colors"><ArrowLeft size={14}/> Quest Map</Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200 shadow-sm">
                  <BarChart size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic text-slate-900 leading-none">Data_<span className="text-indigo-600">Detective</span></h1>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Adaptive Mode // Difficulty: {currentDifficulty}</p>
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

          <div className="bg-white border-2 border-indigo-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <AnimatePresence>
              {/* SUCCESS OVERLAY */}
              {isSuccess && ( 
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce"><CheckCircle2 size={40} /></div>
                  <h2 className="text-3xl font-black uppercase italic text-emerald-600">Report Verified!</h2>
                  <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Scaling Difficulty Up (+1)...</p>
                </motion.div> 
              )}

              {/* FAILURE & LEARNING OVERLAY */}
              {isFailed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-lg mb-6">
                    <AlertCircle size={40} />
                  </div>
                  
                  <h2 className="text-3xl font-black uppercase italic text-rose-600 mb-2">Tally Mismatch</h2>
                  
                  <div className="max-w-md bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 mt-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">System Analysis:</p>
                    <p className="text-lg text-slate-700 leading-relaxed">
                      Your data compilation contained errors. Based on the provided evidence, the correct tallies are:<br/>
                      <span className="inline-block mt-4 text-left">
                      {TALLY_ITEMS.map((item) => {
                        const targetCount = expectedTargets[item.id];
                        if (targetCount !== undefined) {
                          return (
                            <span key={item.id} className="block mt-2 font-black text-slate-800 text-xl capitalize flex items-center gap-3">
                              <span className={`w-3 h-3 rounded-full bg-${item.color}-500`} />
                              {item.label}: <span className={`text-${item.color}-600`}>{targetCount} marks</span>
                            </span>
                          );
                        }
                        return null;
                      })}
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
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Cognitive: {activeQuestion.cognitive_level}
                </div>
                <h2 className="text-2xl font-medium text-slate-700 leading-relaxed">
                  {activeQuestion.prompt}
                </h2>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 md:p-8 space-y-6">
                  {TALLY_ITEMS.map((item) => (
                    <div key={item.id} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white border-2 rounded-2xl shadow-sm transition-colors ${tallies[item.id] > 0 ? 'border-indigo-400' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between md:w-48 shrink-0">
                        <span className={`text-xs font-black uppercase text-${item.color}-600`}>{item.label}</span>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                          <button onClick={() => updateTally(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-rose-500 transition-colors"><Minus size={14}/></button>
                          <button onClick={() => updateTally(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-500 transition-colors"><Plus size={14}/></button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-[50px] border-l-2 border-slate-100 pl-6 flex items-center">
                        <TallyGroup count={tallies[item.id]} />
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleVerify} 
                  disabled={isProcessing || Object.values(tallies).every(v => v === 0)} 
                  className="w-full py-6 bg-indigo-600 text-white rounded-[28px] font-black uppercase italic tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Verify Tally Board
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