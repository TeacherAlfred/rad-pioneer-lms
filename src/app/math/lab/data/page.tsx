"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, BarChart, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Recycle, Database, FileText, Plus, Minus
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// CAPS Context: Environmental Recycling Data
const TARGET_DATA = [
  { id: 'plastic', label: 'Plastic Bottles', target: 12, icon: Recycle, color: 'emerald' },
  { id: 'glass', label: 'Glass Jars', target: 7, icon: Database, color: 'amber' },
  { id: 'paper', label: 'Paper Bundles', target: 14, icon: FileText, color: 'blue' }
];

export default function DataHandlingLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Interactive Tally State
  const [tallies, setTallies] = useState<Record<string, number>>({
    plastic: 0, glass: 0, paper: 0
  });
  
  // Challenge State
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const updateTally = (id: string, delta: number) => {
    setTallies(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min(30, prev[id] + delta))
    }));
  };

  const handleVerify = async () => {
    setIsProcessing(true);
    
    // Check if all tallies match the target data
    const isCorrect = TARGET_DATA.every(item => tallies[item.id] === item.target);

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

        // Update math mastery record for Data Handling
        await supabase.from('math_mastery').upsert({
          student_id: userProfile.id,
          grade: 5,
          content_area: 'Data Handling',
          topic: 'Collecting and Organising Data',
          cognitive_level: 'Routine Procedures',
          mastery_score: 100,
          total_challenges_completed: 1,
          last_activity_at: new Date().toISOString()
        }, { onConflict: 'student_id, grade, content_area, topic' });
      }

      setTimeout(() => {
        setIsProcessing(false);
      }, 2500);

    } else {
      setIsProcessing(false);
      // Error handling/shake effect could go here
    }
  };

  // Helper component to draw accurate CAPS Tally Marks (groups of 5 with a diagonal strike)
  const TallyGroup = ({ count }: { count: number }) => {
    const fives = Math.floor(count / 5);
    const remainder = count % 5;
    
    return (
      <div className="flex flex-wrap gap-4 items-center min-h-[40px]">
        {Array.from({ length: fives }).map((_, i) => (
           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={`five-${i}`} className="relative w-8 h-10 flex justify-between items-center">
              <div className="w-1 h-full bg-slate-700 rounded-full" />
              <div className="w-1 h-full bg-slate-700 rounded-full" />
              <div className="w-1 h-full bg-slate-700 rounded-full" />
              <div className="w-1 h-full bg-slate-700 rounded-full" />
              {/* The diagonal strike for the 5th mark */}
              <motion.div initial={{ width: 0 }} animate={{ width: '40px' }} className="absolute h-1 bg-slate-700 rounded-full rotate-[-45deg] top-1/2 -left-1" />
           </motion.div>
        ))}
        {remainder > 0 && (
           <div className="h-10 flex justify-start gap-1.5 items-center">
              {Array.from({ length: remainder }).map((_, i) => (
                 <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} key={`rem-${i}`} className="w-1 h-full bg-slate-700 rounded-full" />
              ))}
           </div>
        )}
      </div>
    );
  };

  // Build the strict-typed stats object for the wrapper
  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: "Data Detective",
      code: "MTH-DAT",
      accentColor: "#4f46e5", // Indigo theme for Data
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
              <Link href="/math" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors">
                <ArrowLeft size={14} /> Return to Quest Map
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200 shadow-sm">
                  <BarChart size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                    Data_<span className="text-indigo-600">Detective</span>
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mt-1">Apparatus Room: Level 1</p>
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
          <div className="bg-white border-2 border-indigo-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative">
            
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
                  <div className="text-center space-y-4">
                    <div>
                      <h2 className="text-3xl font-black uppercase italic text-emerald-600 tracking-tighter mb-2">Data Verified!</h2>
                      <p className="text-slate-500 font-bold">+50 XP | +2 RAD Sparks</p>
                    </div>
                    <Link 
                      href="/math"
                      className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-600 transition-colors shadow-xl"
                    >
                      Return to Map
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              
              {/* Left Column: Raw Data Context */}
              <div className="lg:col-span-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Active Directive
                </div>
                <div>
                  <h2 className="text-2xl font-medium text-slate-700 leading-relaxed mb-4">
                    The Grade 5 class completed a recycling drive. Review their raw collection data below.
                  </h2>
                  <p className="text-sm text-slate-500">Convert this raw data into organized Tally Marks on the main board.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Raw Data Sheet</h3>
                  {TARGET_DATA.map((item) => (
                    <div key={`raw-${item.id}`} className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <item.icon size={16} className={`text-${item.color}-500`} />
                        <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-lg font-black text-slate-900 tabular-nums">{item.target}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Tally Board Apparatus */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 md:p-8 space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 text-center">Interactive Tally Board</h3>
                  
                  <div className="space-y-6">
                    {TARGET_DATA.map((item) => (
                      <div key={`tally-${item.id}`} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        
                        {/* Label & Controls */}
                        <div className="flex items-center justify-between md:w-48 shrink-0">
                          <span className={`text-xs font-black uppercase tracking-widest text-${item.color}-600`}>
                            {item.label.split(' ')[0]}
                          </span>
                          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                            <button onClick={() => updateTally(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-rose-500 transition-colors"><Minus size={14}/></button>
                            <button onClick={() => updateTally(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-500 transition-colors"><Plus size={14}/></button>
                          </div>
                        </div>

                        {/* The Visual Tallies */}
                        <div className="flex-1 min-h-[50px] border-l-2 border-slate-100 pl-6 flex items-center">
                          <TallyGroup count={tallies[item.id]} />
                        </div>
                        
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Area */}
                <div className="flex justify-center">
                  <button 
                    onClick={handleVerify}
                    disabled={isProcessing}
                    className="px-12 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Verify Data Sheet
                  </button>
                </div>
              </div>

            </div>
          </div>
          
        </div>
      </main>

      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}