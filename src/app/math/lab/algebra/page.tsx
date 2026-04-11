"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Settings, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// CAPS Context: Patterns, Functions, and Algebra (Input/Output & Rules)
const CHALLENGES = [
  { type: 'find_output', input: 7, ruleText: '× 6', targetOutput: 42, prompt: 'Apply the rule to find the output.' },
  { type: 'find_output', input: 48, ruleText: '÷ 8', targetOutput: 6, prompt: 'Apply the division rule to find the output.' },
  { type: 'find_rule', input: 9, output: 45, targetOp: '×', targetVal: 5, prompt: 'Reverse engineer the machine! What rule is it applying?' }
];

export default function AlgebraLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Challenge State
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [machineAnimating, setMachineAnimating] = useState(false);
  
  // User Inputs
  const [userOutput, setUserOutput] = useState<string>("");
  const [userOp, setUserOp] = useState<string>("+");
  const [userVal, setUserVal] = useState<string>("");

  const challenge = CHALLENGES[currentLevel];

  useEffect(() => {
    async function loadUser() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        setUserProfile(profile);
      }
    }
    loadUser();
  }, []);

  const handleVerify = async () => {
    setIsProcessing(true);
    setMachineAnimating(true);
    
    let isCorrect = false;

    if (challenge.type === 'find_output') {
      isCorrect = parseInt(userOutput) === challenge.targetOutput;
    } else {
      isCorrect = userOp === challenge.targetOp && parseInt(userVal) === challenge.targetVal;
    }

    // Wait for the visual "machine processing" animation to finish before showing result
    setTimeout(async () => {
      setMachineAnimating(false);
      
      if (isCorrect) {
        setIsSuccess(true);
        
        if (userProfile) {
          const earnedXP = 50;
          const earnedSparks = 2;

          // Update profile
          await supabase.from('profiles').update({
            xp: (userProfile.xp || 0) + earnedXP,
            sparks: (userProfile.sparks || 0) + earnedSparks
          }).eq('id', userProfile.id);

          // Update math mastery record
          await supabase.from('math_mastery').upsert({
            student_id: userProfile.id,
            grade: 5,
            content_area: 'Patterns, Functions and Algebra',
            topic: 'Numeric Patterns',
            cognitive_level: challenge.type === 'find_rule' ? 'Complex Procedures' : 'Routine Procedures',
            mastery_score: 100,
            total_challenges_completed: currentLevel + 1,
            last_activity_at: new Date().toISOString()
          }, { onConflict: 'student_id, grade, content_area, topic' });
        }

        setTimeout(() => {
          if (currentLevel < CHALLENGES.length - 1) {
            setCurrentLevel(prev => prev + 1);
            setUserOutput("");
            setUserVal("");
            setUserOp("+");
            setIsSuccess(false);
          }
          setIsProcessing(false);
        }, 2500);

      } else {
        setIsProcessing(false);
        // Reset inputs on fail
        setUserOutput("");
        setUserVal("");
      }
    }, 1500); // 1.5 seconds of "processing" time
  };

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: "Algebra Ace",
      code: "MTH-ALG",
      accentColor: "#9333ea", // Purple theme for Algebra
      floor: 0
    },
    nextLevel: { name: "Math Lead", xpRequired: 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        
        {/* Blueprint Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-purple-600 transition-colors">
                <ArrowLeft size={14} /> Return to Quest Map
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center border border-purple-200 shadow-sm">
                  <Zap size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                    The_Rule_<span className="text-purple-600">Machine</span>
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mt-1">Apparatus Room: Level {currentLevel + 1}</p>
                </div>
              </div>
            </div>

            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase">Sparks Earned</p>
                <p className="text-xl font-black text-amber-500 italic leading-none">{userProfile?.sparks || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                <Zap size={20} fill="currentColor" />
              </div>
            </div>
          </header>

          {/* THE CHALLENGE BOARD */}
          <div className="bg-white border-2 border-purple-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            
            {/* Success Overlay */}
            <AnimatePresence>
              {isSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="text-center space-y-4">
                    <div>
                      <h2 className="text-3xl font-black uppercase italic text-emerald-600 tracking-tighter mb-2">Logic Verified!</h2>
                      <p className="text-slate-500 font-bold">+50 XP | +2 RAD Sparks</p>
                    </div>
                    {currentLevel === CHALLENGES.length - 1 && (
                      <Link 
                        href="/math"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-purple-600 transition-colors shadow-xl"
                      >
                        Return to Map
                      </Link>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto space-y-12 relative z-10">
              
              {/* Challenge Prompt */}
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 text-purple-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Active Directive
                </div>
                <h2 className="text-2xl md:text-3xl font-medium text-slate-700 leading-relaxed">
                  {challenge?.prompt}
                </h2>
              </div>

              {/* The Visual Machine Apparatus */}
              <div className="relative py-12">
                {/* Connecting Pipes (Background) */}
                <div className="absolute top-1/2 left-0 w-full h-4 bg-slate-200 -translate-y-1/2 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-purple-400 w-1/3"
                    initial={{ x: '-100%' }}
                    animate={machineAnimating ? { x: ['-100%', '300%'] } : { x: '-100%' }}
                    transition={{ duration: 1.5, ease: "linear" }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 items-center relative z-10">
                  
                  {/* Input Block */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Input</span>
                    <div className="w-24 h-24 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-4xl font-black text-slate-800">{challenge.input}</span>
                    </div>
                  </div>

                  {/* Processing Core */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">Processing Core</span>
                    <div className="w-32 h-32 bg-purple-600 rounded-[32px] flex items-center justify-center shadow-xl shadow-purple-200 border-4 border-purple-400 relative overflow-hidden">
                      <Settings className={`absolute opacity-20 text-white w-48 h-48 ${machineAnimating ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                      
                      <div className="relative z-10 text-white font-black text-2xl">
                        {challenge.type === 'find_output' ? (
                          <span>{challenge.ruleText}</span>
                        ) : (
                          <div className="flex items-center gap-2 bg-purple-800/50 p-2 rounded-xl backdrop-blur-sm">
                            <select 
                              value={userOp} 
                              onChange={(e) => setUserOp(e.target.value)}
                              disabled={isProcessing}
                              className="bg-transparent text-white outline-none appearance-none cursor-pointer font-black text-center text-xl"
                            >
                              <option value="+" className="text-black">+</option>
                              <option value="-" className="text-black">-</option>
                              <option value="×" className="text-black">×</option>
                              <option value="÷" className="text-black">÷</option>
                            </select>
                            <input 
                              type="number" 
                              value={userVal}
                              onChange={(e) => setUserVal(e.target.value)}
                              disabled={isProcessing}
                              className="w-12 bg-transparent text-white border-b-2 border-white/30 text-center outline-none focus:border-white placeholder:text-white/30 font-black text-2xl"
                              placeholder="?"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Output Block */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Output</span>
                    <div className="w-24 h-24 bg-white border-4 border-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100 overflow-hidden">
                      {challenge.type === 'find_rule' ? (
                        <span className="text-4xl font-black text-slate-800">{challenge.output}</span>
                      ) : (
                        <input 
                          type="number"
                          value={userOutput}
                          onChange={(e) => setUserOutput(e.target.value)}
                          disabled={isProcessing}
                          className="w-full h-full text-center text-4xl font-black text-emerald-600 outline-none bg-transparent placeholder:text-emerald-200"
                          placeholder="?"
                        />
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Area */}
              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleVerify}
                  disabled={isProcessing || (challenge.type === 'find_output' && !userOutput) || (challenge.type === 'find_rule' && !userVal)}
                  className="px-12 py-5 bg-purple-600 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
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