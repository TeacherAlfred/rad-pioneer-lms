"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { 
  Zap, Brain, Triangle, Ruler, BarChart, Lock, 
  CheckCircle2, Play, Sparkles, Clock, ChevronRight,
  Cpu, Mail, ArrowRight, Loader2, X, Target
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
  const [loading, setLoading] = useState(true);

  const [selectedLevels, setSelectedLevels] = useState<Record<string, number>>({
    numbers: 1, algebra: 1, geometry: 1, measurement: 1, data: 1
  });

  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  useEffect(() => {
    async function checkDailySprint() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) return;
      const localUser = JSON.parse(sessionData);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      setUserProfile(profile);

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

  const handleUnlockMission = async () => {
    if (!userProfile || userProfile.sparks < 5) return;
    setUnlockStatus('processing');
    try {
      const newSparks = userProfile.sparks - 5;
      await supabase.from('profiles').update({ sparks: newSparks }).eq('id', userProfile.id);
      setUserProfile((prev: any) => ({ ...prev, sparks: newSparks }));
      await new Promise(resolve => setTimeout(resolve, 2500)); 
      setUnlockStatus('success');
    } catch (error) {
      console.error("Unlock failed", error);
      setUnlockStatus('idle');
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading_Math_Lab</span>
    </div>
  );

  const stats = {
    xp: userProfile?.xp || 0,
    level: (userProfile?.xp || 0) >= 1000 ? 2 : 1,
    currentLevel: { name: "Pioneer", code: "MTH-01", accentColor: "#3b82f6", floor: 0 },
    nextLevel: { name: "Math Lead", xpRequired: 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#F8FAFC] text-slate-900 relative overflow-hidden pb-24">
        
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-10 relative z-10">
          
          {/* HEADER SECTION */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Target size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Main Logic Interface</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Quest_<span className="text-blue-600">Map</span>
              </h1>
            </div>

            <button 
              onClick={() => setIsRewardsOpen(true)}
              className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-[32px] border border-white shadow-sm flex items-center gap-6 hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className="text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pioneer Sparks</p>
                <p className="text-3xl font-black text-amber-500 italic leading-none tabular-nums">{userProfile?.sparks || 0}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 shadow-inner group-hover:rotate-12 transition-transform">
                <Zap size={28} fill="currentColor" />
              </div>
            </button>
          </header>

          {/* UNIFIED GRADE SUB-HEADER */}
          <div className="relative group w-full md:w-fit mx-auto md:mx-0">
             <div className="relative bg-white border border-slate-200 px-8 py-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                   <span className="text-xs font-black uppercase tracking-widest text-slate-900">Unified CAPS Curriculum</span>
                </div>
                <div className="hidden md:block w-px h-4 bg-slate-200" />
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Grades 4 — 6</span>
             </div>
          </div>

          {/* THE SECTOR MAP GRID */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {SECTORS.map((sector) => {
                const currentLevel = selectedLevels[sector.id] || 1;

                return (
                  <motion.div 
                    key={sector.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group relative bg-white border border-slate-100 rounded-[50px] p-8 md:p-10 transition-all hover:shadow-[0_30px_60px_rgba(0,0,0,0.04)] ${!hasCompletedSprint ? 'blur-[4px] pointer-events-none grayscale opacity-30' : ''}`}
                  >
                    {/* Header: Icon and Full-Width Heading */}
                    <div className="flex items-center gap-5 mb-8">
                       <div className={`w-16 h-16 shrink-0 rounded-[22px] ${sector.themeBg} ${sector.themeText} flex items-center justify-center border ${sector.themeBorder} shadow-sm group-hover:scale-105 transition-transform`}>
                         <sector.icon size={32} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-[0.9] break-words">
                            {sector.title}
                          </h3>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                      {/* CAPS Weight Sit as a small badge before description */}
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-widest">
                          {sector.weight} Curriculum Weight
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium line-clamp-2 min-h-[40px]">
                        {sector.description}
                      </p>
                    </div>
                    
                    <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                     
                      <Link 
                        href={`/math/lab/${sector.id}?level=${currentLevel}&grade=4`} 
                        className={`flex items-center gap-2 text-xs font-black uppercase ${sector.themeText} hover:gap-4 transition-all active:scale-95`}
                      >
                        Enter Lab <ChevronRight size={18} strokeWidth={3} />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* LOCKED STATE OVERLAY */}
            <AnimatePresence>
              {!hasCompletedSprint && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 z-20 flex items-start justify-center pt-20"
                >
                  <div className="bg-white/90 backdrop-blur-xl border border-blue-100 p-10 md:p-14 rounded-[60px] shadow-[0_50px_100px_rgba(0,0,0,0.1)] max-w-md text-center space-y-8 sticky top-32">
                    <div className="w-24 h-24 bg-blue-600 text-white rounded-[32px] flex items-center justify-center mx-auto shadow-[0_20px_40px_rgba(37,99,235,0.3)]">
                      <Clock size={48} />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-slate-900 text-center">Brain Check Needed</h2>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Finish your quick Brain Check to unlock the laboratory and start earning rewards for today.
                      </p>
                    </div>
                    <button 
                      onClick={() => window.location.href = '/math/sprint'}
                      className="flex items-center justify-center gap-3 w-full py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase tracking-[0.1em] text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-[0.98]"
                    >
                      Start Brain Check <ChevronRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* REWARDS MODAL */}
        <AnimatePresence>
          {isRewardsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { if(unlockStatus !== 'processing') setIsRewardsOpen(false); }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 40 }} 
                className="relative w-full max-w-xl bg-white border border-white rounded-[50px] shadow-[0_50px_120px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-5 text-left">
                    <div className="w-14 h-14 bg-amber-50 border border-amber-100 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner">
                      <Zap size={28} fill="currentColor" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Pioneer Depot</h2>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        Available Balance: {userProfile?.sparks || 0} Sparks
                      </p>
                    </div>
                  </div>
                  {unlockStatus !== 'processing' && (
                    <button onClick={() => setIsRewardsOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-2xl transition-all">
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="p-8 md:p-10 bg-slate-50/50">
                  {unlockStatus === 'idle' && (
                    <div className="space-y-8">
                      <div className="text-left space-y-2">
                        <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-800">New Mission Detected</h3>
                        <p className="text-sm text-slate-500 font-medium">Trade your sparks to unlock premium engineering missions.</p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-[36px] p-8 flex flex-col items-center gap-6 shadow-sm">
                        <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-[28px] flex items-center justify-center text-blue-500 shadow-inner">
                          <Cpu size={40} />
                        </div>
                        <div className="text-center space-y-3">
                          <h4 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Smart Home Protocol</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto text-center">Build an automated logic system using robotics hardware components.</p>
                        </div>
                        <div className="bg-slate-900 text-white px-8 py-3 rounded-full flex items-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200">
                          Cost: <span className="text-amber-400 flex items-center gap-1"><Zap size={14} fill="currentColor"/> 5 Sparks</span>
                        </div>
                      </div>

                      <div className="pt-4">
                        {(userProfile?.sparks || 0) >= 5 ? (
                          <button 
                            onClick={handleUnlockMission}
                            className="w-full py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase italic tracking-widest text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 active:scale-[0.98]"
                          >
                            Spend 5 Sparks to Unlock
                          </button>
                        ) : (
                          <div className="w-full py-6 bg-slate-200 text-slate-400 rounded-[28px] font-black uppercase italic tracking-widest text-xs text-center cursor-not-allowed">
                            Need {5 - (userProfile?.sparks || 0)} more Sparks
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {unlockStatus === 'processing' && (
                    <div className="py-20 flex flex-col items-center justify-center gap-8">
                      <div className="relative">
                        <Loader2 className="animate-spin text-blue-600" size={64} />
                        <div className="absolute inset-0 blur-2xl bg-blue-400/20 animate-pulse" />
                      </div>
                      <div className="text-center space-y-3">
                        <h3 className="text-2xl font-black uppercase italic tracking-widest text-slate-900 leading-none">Saving results...</h3>
                        <p className="text-slate-500 text-sm font-medium">Archiving performance data and notifying Parent.</p>
                      </div>
                    </div>
                  )}

                  {unlockStatus === 'success' && (
                    <div className="py-6 flex flex-col items-center text-center space-y-8">
                      <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center shadow-inner border border-emerald-100">
                        <CheckCircle2 size={48} />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Unlocked!</h3>
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[28px] p-6 text-left flex items-start gap-5">
                          <Mail className="text-emerald-600 shrink-0 mt-1" size={20} />
                          <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                            <span className="font-black block mb-1">Email Sent:</span>
                            Parent authorized. High logic aptitude detected. A new engineering mission has been added to your dashboard.
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => router.push('/student/dashboard')}
                        className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black uppercase italic tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3"
                      >
                        Enter Engineering Bay <ArrowRight size={20} />
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