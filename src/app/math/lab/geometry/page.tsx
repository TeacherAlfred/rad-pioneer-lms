"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Triangle, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Square, RectangleHorizontal, Hexagon, Box, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const SHAPE_TOOLS = [
  { id: 'square', name: 'Square', icon: Square, color: 'blue' },
  { id: 'triangle', name: 'Triangle', icon: Triangle, color: 'emerald' },
  { id: 'rectangle', name: 'Rectangle', icon: RectangleHorizontal, color: 'purple' },
  { id: 'hexagon', name: 'Hexagon', icon: Hexagon, color: 'rose' }
];

export default function GeometryLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Adaptive Engine State
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3); 
  
  const [inventory, setInventory] = useState<Record<string, number>>({ square: 0, triangle: 0, rectangle: 0, hexagon: 0 });
  
  // UI Flow State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [forgeAnimating, setForgeAnimating] = useState(false);

  const updateInventory = (id: string, delta: number) => {
    setInventory(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min(20, prev[id] + delta)) // Increased max to 20 for complex shapes
    }));
  };

  // Helper: Renders what the user has currently placed in the forge
  const renderForgeInventory = (currentInventory: Record<string, number>) => {
    const addedShapes = SHAPE_TOOLS.filter(tool => currentInventory[tool.id] > 0);

    if (addedShapes.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 opacity-30">
          <Box size={64} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 text-center">
            Forge Empty <br /> Add Components
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-8 w-full">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 px-4">
          <AnimatePresence>
            {addedShapes.map((shape) => (
              <motion.div 
                key={shape.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-orange-500/10 border border-orange-500/30 flex items-center justify-center relative group shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                  <shape.icon size={40} className="text-orange-500 relative z-10" strokeWidth={1.5} />
                  
                  {/* Live Counter Badge */}
                  <motion.div 
                    key={currentInventory[shape.id]} // Forces re-animation when number changes
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 border-2 border-orange-500 rounded-full flex items-center justify-center text-[12px] font-black text-orange-500 shadow-lg"
                  >
                    {currentInventory[shape.id]}
                  </motion.div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/80">
                  {shape.name}s
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-2 mt-4">
           <div className="h-px w-32 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
           <p className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-500/60 animate-pulse">
             Active Forge Components
           </p>
        </div>
      </div>
    );
  };

  const pickRandomFromPool = useCallback((questions: any[], level: number) => {
    const pool = questions.filter(q => q.difficulty_level === level);
    const selected = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)] 
      : questions[Math.floor(Math.random() * questions.length)];

    if (selected) {
      setInventory({ square: 0, triangle: 0, rectangle: 0, hexagon: 0 }); // Reset inventory for new question
    }
    return selected;
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        const sessionData = localStorage.getItem("pioneer_session");
        if (sessionData) {
          const localUser = JSON.parse(sessionData);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
          setUserProfile(profile);
        }

        const { data, error } = await supabase.from('math_lab_questions').select('*').eq('sector', 'geometry');
        if (error) throw error;

        if (data && data.length > 0) {
          const shuffledData = [...data].sort(() => Math.random() - 0.5);
          setAllQuestions(shuffledData);
          setActiveQuestion(pickRandomFromPool(shuffledData, 3));
        } else {
          setDbError("No geometry schematics found.");
        }
      } catch (err: any) {
        setDbError(err.message);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, [pickRandomFromPool]);

  const handleVerify = async () => {
    if (!activeQuestion) return;
    setIsProcessing(true);
    setForgeAnimating(true);
    
    const config = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;
    const required = config?.requiredFaces || config || {};
    
    const faceCounts: Record<string, number> = {
      square: required.square || required.Square || 0,
      triangle: required.triangle || required.Triangle || 0,
      rectangle: required.rectangle || required.Rectangle || 0,
      hexagon: required.hexagon || required.Hexagon || 0
    };
    
    const isCorrect = 
      inventory.square === faceCounts.square &&
      inventory.triangle === faceCounts.triangle &&
      inventory.rectangle === faceCounts.rectangle &&
      inventory.hexagon === faceCounts.hexagon;

    setTimeout(async () => {
      setForgeAnimating(false);
      setIsProcessing(false);
      
      if (isCorrect) {
        setIsSuccess(true);
        if (userProfile) {
          await supabase.from('profiles').update({ 
            xp: (userProfile.xp || 0) + (activeQuestion.xp_reward || 50), 
            sparks: (userProfile.sparks || 0) + (activeQuestion.sparks_reward || 2) 
          }).eq('id', userProfile.id);
        }
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
    }, 2000);
  };

  // NEW: Manual continue after reading the explanation
  const handleFailContinue = () => {
    setIsFailed(false);
    const nextDifficulty = Math.max(1, currentDifficulty - 1); // Scale down
    setCurrentDifficulty(nextDifficulty);
    setActiveQuestion(pickRandomFromPool(allQuestions, nextDifficulty));
  };

  if (loading || !activeQuestion) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-orange-600" size={40} /></div>;

  const currentConfig = typeof activeQuestion.config === 'string' ? JSON.parse(activeQuestion.config) : activeQuestion.config;

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: (userProfile?.xp || 0) >= 1000 ? 2 : 1, currentLevel: { name: "Geometry Architect", code: "MTH-GEO", accentColor: "#f97316", floor: 0 }, nextLevel: { name: "Math Lead", xpRequired: 1000 } }}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 hover:text-orange-600 transition-colors"><ArrowLeft size={14}/> Map</Link>
              <h1 className="text-3xl font-black uppercase italic text-slate-900">Geometry_<span className="text-orange-600">Forge</span></h1>
              <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">Adaptive Mode // Difficulty: {currentDifficulty}</p>
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

          <div className="bg-white border-2 border-orange-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <AnimatePresence>
              {/* SUCCESS OVERLAY */}
              {isSuccess && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce"><CheckCircle2 size={40} /></div>
                  <h2 className="text-3xl font-black uppercase italic text-emerald-600">Structure Forge Complete</h2>
                  <p className="font-bold text-slate-500 tracking-widest uppercase text-xs">Calibrating Next Protocol (+1)...</p>
                </motion.div>
              )}

              {/* FAILURE & LEARNING OVERLAY */}
              {isFailed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-lg mb-6">
                    <AlertCircle size={40} />
                  </div>
                  
                  <h2 className="text-3xl font-black uppercase italic text-rose-600 mb-2">Blueprint Mismatch</h2>
                  
                  <div className="max-w-md bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 mt-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">System Analysis:</p>
                    <p className="text-lg text-slate-700 leading-relaxed">
                      A <span className="font-black text-slate-900">{currentConfig.targetName || "3D Object"}</span> is constructed using specific 2D components. You need exactly: <br/>
                      <span className="inline-block mt-3 text-left">
                      {Object.entries(currentConfig.requiredFaces || {})
                        .filter(([_, count]: any) => count > 0)
                        .map(([shape, count]: any) => (
                          <span key={shape} className="block mt-1 font-black text-orange-600 text-xl capitalize">
                            {count}x {shape}s
                          </span>
                      ))}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest">
                   <Shield size={14} /> Blueprint Target: {currentConfig.targetName || "Custom Shape"}
                </div>
                <h2 className="text-2xl font-black italic text-slate-800 leading-tight">{activeQuestion.prompt}</h2>
                
                {/* LIVE WORKSPACE VIEWPORT */}
                <div className="relative w-full aspect-square bg-slate-900 rounded-[32px] border-4 border-slate-800 shadow-inner flex flex-col items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  
                  <div className="relative z-10 w-full">
                     {/* PASS THE USER'S INVENTORY, NOT THE ANSWER KEY */}
                     {renderForgeInventory(inventory)}
                  </div>
                  
                  {forgeAnimating && <motion.div className="absolute left-0 right-0 h-1 bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,1)] z-20" initial={{ top: 0 }} animate={{ top: '100%' }} transition={{ duration: 1, repeat: 1 }} />}
                </div>
              </div>

              <div className="space-y-8 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  {SHAPE_TOOLS.map(shape => (
                    <div key={shape.id} className={`bg-white border-2 rounded-2xl p-4 transition-all ${inventory[shape.id] > 0 ? `border-orange-400 shadow-md` : 'border-slate-200'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center`}><shape.icon size={20} /></div>
                        <span className="text-2xl font-black tabular-nums">{inventory[shape.id]}</span>
                      </div>
                      <p className="text-[9px] font-black uppercase text-slate-400 text-center mb-2">{shape.name}</p>
                      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        <button onClick={() => updateInventory(shape.id, -1)} className="flex-1 py-2 bg-white rounded-lg font-black hover:bg-rose-50 hover:text-rose-500 transition-colors">-</button>
                        <button onClick={() => updateInventory(shape.id, 1)} className="flex-1 py-2 bg-white rounded-lg font-black hover:bg-emerald-50 hover:text-emerald-500 transition-colors">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleVerify} 
                  disabled={isProcessing || Object.values(inventory).every(v => v === 0)} 
                  className="w-full py-6 bg-orange-500 text-white rounded-[28px] font-black uppercase italic shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Forge 3D Object
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