"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Brain, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// CAPS-aligned equivalent fraction challenges
const CHALLENGES = [
  { targetNum: 1, targetDen: 2, requiredDen: 8, prompt: "Create a fraction equivalent to 1/2 using 8 slices." },
  { targetNum: 1, targetDen: 3, requiredDen: 6, prompt: "Create a fraction equivalent to 1/3 using 6 slices." },
  { targetNum: 3, targetDen: 4, requiredDen: 12, prompt: "Create a fraction equivalent to 3/4 using 12 slices." },
];

export default function NumbersLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Interactive Fraction State
  const [numerator, setNumerator] = useState(0);
  const [denominator, setDenominator] = useState(1); // Start as a whole
  
  // Challenge State
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const challenge = CHALLENGES[currentLevel];

  useEffect(() => {
    async function loadUser() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        setUserProfile(profile);
      }
      // Initialize the first challenge
      setDenominator(CHALLENGES[0].requiredDen);
      setNumerator(0);
    }
    loadUser();
  }, []);

  const handleVerify = async () => {
    setIsProcessing(true);
    
    // Mathematical check for equivalence: (num1/den1) == (num2/den2)
    // Cross multiplication is the safest way to check: num1 * den2 == num2 * den1
    const isEquivalent = (numerator * challenge.targetDen) === (challenge.targetNum * denominator);
    const isCorrectFormat = denominator === challenge.requiredDen;

    if (isEquivalent && isCorrectFormat) {
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
          content_area: 'Numbers, Operations and Relationships',
          topic: 'Common Fractions',
          cognitive_level: 'Routine Procedures',
          mastery_score: 100,
          total_challenges_completed: currentLevel + 1,
          last_activity_at: new Date().toISOString()
        }, { onConflict: 'student_id, grade, content_area, topic' });
      }

      setTimeout(() => {
        if (currentLevel < CHALLENGES.length - 1) {
          setCurrentLevel(prev => prev + 1);
          setDenominator(CHALLENGES[currentLevel + 1].requiredDen);
          setNumerator(0);
          setIsSuccess(false);
        }
        setIsProcessing(false);
      }, 2500);

    } else {
      // Shake animation effect could go here
      setIsProcessing(false);
    }
  };

  // Add this block right before return (...)
  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: "Fraction Master",
      code: "MTH-NUM",
      accentColor: "#3b82f6", // Blue theme for Numbers
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
              <Link href="/math" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
                <ArrowLeft size={14} /> Return to Quest Map
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 shadow-sm">
                  <Brain size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                    Fraction_<span className="text-blue-600">Slicer</span>
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mt-1">Apparatus Room: Level {currentLevel + 1}</p>
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
          <div className="bg-white border-2 border-blue-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative">
            
            {/* Success Overlay */}
            <AnimatePresence>
              {isSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-3xl font-black uppercase italic text-emerald-600 tracking-tighter mb-2">Equivalence Verified!</h2>
                    <p className="text-slate-500 font-bold">+50 XP | +2 RAD Sparks</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-2xl mx-auto space-y-12">
              {/* Challenge Prompt */}
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Active Directive
                </div>
                <h2 className="text-2xl md:text-3xl font-medium text-slate-700 leading-relaxed">
                  {challenge?.prompt}
                </h2>
              </div>

              {/* The Slicer Apparatus */}
              <div className="space-y-8">
                
                {/* Visual Representation (The Bar) */}
                <div className="relative h-24 w-full bg-slate-100 rounded-2xl border-4 border-slate-200 overflow-hidden flex">
                  {Array.from({ length: denominator }).map((_, i) => (
                    <motion.div 
                      key={i}
                      onClick={() => setNumerator(i + 1)}
                      className={`flex-1 border-r-2 border-white/50 cursor-pointer transition-colors duration-300 ${i < numerator ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-100'}`}
                    />
                  ))}
                  {/* Target Reference Overlay (Ghosted) */}
                  <div className="absolute inset-0 pointer-events-none border-b-8 border-emerald-400/30" style={{ width: `${(challenge?.targetNum / challenge?.targetDen) * 100}%` }} />
                </div>

                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                  <span>0</span>
                  <span className="text-emerald-500">Target: {challenge?.targetNum}/{challenge?.targetDen}</span>
                  <span>1 Whole</span>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  
                  {/* Numerator Control */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 block text-center">Numerator (Shaded)</label>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2">
                      <button 
                        onClick={() => setNumerator(Math.max(0, numerator - 1))}
                        className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 font-black text-xl hover:bg-blue-50 transition-colors"
                      >-</button>
                      <span className="text-3xl font-black tabular-nums text-slate-800">{numerator}</span>
                      <button 
                        onClick={() => setNumerator(Math.min(denominator, numerator + 1))}
                        className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 font-black text-xl hover:bg-blue-50 transition-colors"
                      >+</button>
                    </div>
                  </div>

                  {/* Denominator Control */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">Denominator (Slices)</label>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2">
                      <button 
                        onClick={() => {
                          const newDen = Math.max(1, denominator - 1);
                          setDenominator(newDen);
                          if (numerator > newDen) setNumerator(newDen);
                        }}
                        className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 font-black text-xl hover:bg-slate-100 transition-colors"
                      >-</button>
                      <span className="text-3xl font-black tabular-nums text-slate-800">{denominator}</span>
                      <button 
                        onClick={() => setDenominator(Math.min(12, denominator + 1))}
                        className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 font-black text-xl hover:bg-slate-100 transition-colors"
                      >+</button>
                    </div>
                  </div>

                </div>

              </div>

              {/* Action Area */}
              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleVerify}
                  disabled={isProcessing || numerator === 0}
                  className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Verify Equivalence
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