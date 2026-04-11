"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { 
  Zap, Brain, Triangle, Ruler, BarChart, Lock, 
  CheckCircle2, Play, Sparkles, Clock, ChevronRight,
  Cpu, Mail, ArrowRight, Loader2, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SECTORS = [
  { id: 'numbers', title: 'Numbers & Operations', weight: '50%', themeText: 'text-blue-600', themeBg: 'bg-blue-50', themeBorder: 'border-blue-100', themeActive: 'bg-blue-500', icon: Brain, description: 'Number sense, fractions, and calculation logic.' },
  { id: 'algebra', title: 'Patterns & Algebra', weight: '10%', themeText: 'text-purple-600', themeBg: 'bg-purple-50', themeBorder: 'border-purple-100', themeActive: 'bg-purple-500', icon: Zap, description: 'Flow diagrams, number sentences, and rules.' },
  { id: 'geometry', title: 'Space & Shape', weight: '15%', themeText: 'text-orange-600', themeBg: 'bg-orange-50', themeBorder: 'border-orange-100', themeActive: 'bg-orange-500', icon: Triangle, description: '2D shapes, 3D objects, and symmetry.' },
  { id: 'measurement', title: 'Measurement', weight: '15%', themeText: 'text-emerald-600', themeBg: 'bg-emerald-50', themeBorder: 'border-emerald-100', themeActive: 'bg-emerald-500', icon: Ruler, description: 'Time, length, mass, and volume labs.' },
  { id: 'data', title: 'Data Handling', weight: '10%', themeText: 'text-indigo-600', themeBg: 'bg-indigo-50', themeBorder: 'border-indigo-100', themeActive: 'bg-indigo-500', icon: BarChart, description: 'Graphs, probability, and statistics.' },
];

export default function MathQuestMap() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasCompletedSprint, setHasCompletedSprint] = useState(false);
  const [activeGrade, setActiveGrade] = useState(4);
  const [loading, setLoading] = useState(true);

  // Sector Level Tracking
  const [selectedLevels, setSelectedLevels] = useState<Record<string, number>>({
    numbers: 1, algebra: 1, geometry: 1, measurement: 1, data: 1
  });

  // LEAD-GEN BRIDGE STATE
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  useEffect(() => {
    async function checkDailySprint() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) return;
      const localUser = JSON.parse(sessionData);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      setUserProfile(profile);

      // Check if sprint was completed today
      const today = new Date().toISOString().split('T')[0];
      const { data: sprint } = await supabase
        .from('math_daily_sprints')
        .select('id')
        .eq('student_id', localUser.id)
        .gte('created_at', today)
        .limit(1);

      if (sprint && sprint.length > 0) setHasCompletedSprint(true);
      setLoading(false);
    }
    checkDailySprint();
  }, []);

  // --- LEAD GEN CONVERSION LOGIC ---
  const handleUnlockMission = async () => {
    if (!userProfile || userProfile.sparks < 5) return;
    
    setUnlockStatus('processing');

    try {
      // 1. Deduct Sparks
      const newSparks = userProfile.sparks - 5;
      await supabase.from('profiles').update({ sparks: newSparks }).eq('id', userProfile.id);
      
      // Update local state instantly for UI
      setUserProfile((prev: any) => ({ ...prev, sparks: newSparks }));

      // 2. Simulate the API call to email parents and unlock the mission
      // In a real scenario, this hits a Next.js API route that uses Resend/SendGrid
      await new Promise(resolve => setTimeout(resolve, 2500)); 

      setUnlockStatus('success');

    } catch (error) {
      console.error("Unlock failed", error);
      setUnlockStatus('idle');
    }
  };

  if (loading) return <div className="h-screen bg-[#f8fafc] flex items-center justify-center italic text-slate-400">Booting_Math_Lab...</div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: "Pioneer",
      code: "MTH-01",
      accentColor: "#3b82f6",
      floor: 0
    },
    nextLevel: { name: "Math Lead", xpRequired: 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-12 relative z-10">
          
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Math_Lab</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Quest_<span className="text-blue-600">Map</span>
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* INTERACTIVE REWARDS TRIGGER */}
              <button 
                onClick={() => setIsRewardsOpen(true)}
                className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:ring-2 hover:ring-amber-400 hover:border-amber-400 transition-all cursor-pointer group"
              >
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase group-hover:text-amber-600 transition-colors">Spend Sparks</p>
                  <p className="text-xl font-black text-amber-500 italic leading-none">{userProfile?.sparks || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200 group-hover:scale-110 transition-transform">
                  <Zap size={20} fill="currentColor" />
                </div>
              </button>
            </div>
          </header>

          {/* GRADE SELECTOR */}
          <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200">
            {[4, 5, 6].map((grade) => (
              <button 
                key={grade}
                onClick={() => setActiveGrade(grade)}
                className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeGrade === grade ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Grade {grade}
              </button>
            ))}
          </div>

          {/* THE MAP GRID */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SECTORS.map((sector) => {
                const currentLevel = selectedLevels[sector.id] || 1;

                return (
                  <div 
                    key={sector.id}
                    className={`group relative bg-white border border-slate-200 rounded-[40px] p-8 transition-all hover:shadow-xl hover:-translate-y-1 ${!hasCompletedSprint ? 'blur-[2px] pointer-events-none opacity-50' : ''}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl ${sector.themeBg} ${sector.themeText} flex items-center justify-center mb-6 border ${sector.themeBorder}`}>
                      <sector.icon size={28} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase italic tracking-tight">{sector.title}</h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{sector.weight} CAPS</span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">{sector.description}</p>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                      
                      {/* INTERACTIVE LEVEL SELECTOR */}
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(level => {
                          const isActive = currentLevel === level;
                          return (
                            <button 
                              key={level}
                              onClick={() => setSelectedLevels(prev => ({ ...prev, [sector.id]: level }))}
                              className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black transition-all ${
                                isActive 
                                  ? `${sector.themeActive} text-white shadow-md z-10 scale-110` 
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:z-10'
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>

                      {/* ROUTING */}
                      <Link 
                        href={`/math/lab/${sector.id}?level=${currentLevel}&grade=${activeGrade}`} 
                        className={`flex items-center gap-2 text-[10px] font-black uppercase ${sector.themeText} hover:gap-3 transition-all`}
                      >
                        Enter Lab <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DAILY SPRINT GATE OVERLAY */}
            <AnimatePresence>
              {!hasCompletedSprint && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 z-20 flex items-center justify-center"
                >
                  <div className="bg-white/80 backdrop-blur-md border border-blue-200 p-10 rounded-[48px] shadow-2xl max-w-md text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
                      <Clock size={40} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">System_Locked</h2>
                      <p className="text-slate-600 text-sm font-medium leading-relaxed">
                        Complete your 10-minute Mental Math Warm-up to calibrate your cognitive sensors and unlock today's missions.
                      </p>
                    </div>
                    <button 
                      onClick={() => window.location.href = '/math/sprint'}
                      className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                    >
                      Start Daily Sprint <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* --- LEAD-GEN BRIDGE MODAL (THE PIONEER DEPOT) --- */}
        <AnimatePresence>
          {isRewardsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { if(unlockStatus !== 'processing') setIsRewardsOpen(false); }}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-2xl bg-[#020617] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col text-white"
              >
                {/* Modal Header (Dark Theme to contrast Math Lab) */}
                <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
                      <Zap size={24} fill="currentColor" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">Pioneer Depot</h2>
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">
                        You have {userProfile?.sparks || 0} Sparks available
                      </p>
                    </div>
                  </div>
                  {unlockStatus !== 'processing' && (
                    <button onClick={() => setIsRewardsOpen(false)} className="p-2 text-slate-500 hover:text-white bg-white/5 rounded-xl transition-all">
                      <X size={20} />
                    </button>
                  )}
                </div>

                {/* Modal Body */}
                <div className="p-6 md:p-8 space-y-8 bg-black/20">
                  
                  {unlockStatus === 'idle' && (
                    <>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-slate-300">Unlock Premium Missions</h3>
                        <p className="text-sm text-slate-500">Trade the Sparks you earn in the Math Lab to access exclusive engineering missions in the main Academy.</p>
                      </div>

                      {/* Reward Card */}
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-24 h-24 bg-blue-600/20 border-2 border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
                          <Cpu size={40} />
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">Robotics Sector</span>
                          <h4 className="text-xl font-black uppercase italic tracking-tight text-white">Smart Home Protocol</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Program sensors and logic gates to build an automated security system.</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-6 py-4 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Cost</span>
                          <span className="text-3xl font-black italic text-amber-500 flex items-center gap-1"><Zap size={20} fill="currentColor"/> 5</span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex justify-center pt-4">
                        {(userProfile?.sparks || 0) >= 5 ? (
                          <button 
                            onClick={handleUnlockMission}
                            className="w-full md:w-auto px-12 py-5 bg-amber-500 text-black rounded-2xl font-black uppercase italic tracking-widest hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3"
                          >
                            Spend 5 Sparks to Unlock
                          </button>
                        ) : (
                          <div className="w-full md:w-auto px-12 py-5 bg-white/5 border border-white/10 text-slate-500 rounded-2xl font-black uppercase italic tracking-widest text-center">
                            Need {5 - (userProfile?.sparks || 0)} more Sparks
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {unlockStatus === 'processing' && (
                    <div className="py-20 flex flex-col items-center justify-center space-y-6">
                      <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-amber-500 rounded-full border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                          <Cpu size={32} className="animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-black uppercase tracking-widest text-white italic">Initializing Access...</h3>
                        <p className="text-slate-400 text-sm">Processing aptitude data and generating parent notification.</p>
                      </div>
                    </div>
                  )}

                  {unlockStatus === 'success' && (
                    <div className="py-10 flex flex-col items-center justify-center text-center space-y-8">
                      <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={48} />
                      </div>
                      
                      <div className="space-y-4 max-w-sm">
                        <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Mission Unlocked!</h3>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left flex items-start gap-4">
                          <Mail className="text-blue-400 shrink-0 mt-1" size={20} />
                          <p className="text-xs text-slate-300 leading-relaxed">
                            <span className="text-white font-bold block mb-1">Parent Notification Sent:</span>
                            "Your child has shown a high logic aptitude in mathematics! They have earned access to a free Engineering Mission. Check their dashboard..."
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => router.push('/student/dashboard')}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
                      >
                        Enter the Engineering Bay <ArrowRight size={20} />
                      </button>
                    </div>
                  )}

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}