"use client";

import { useEffect, useState, Suspense } from "react";
import { 
  ChevronLeft, Lock, CheckCircle2, Loader2, 
  Zap, BarChart3, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Clock, CalendarClock
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";

// Safely parse JSON configs from Supabase whether they return as strings or objects
const safeParse = (data: any) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try { return JSON.parse(data); } catch(e) { return {}; }
};

// Format dates beautifully (e.g. "Apr 15, 2026")
const formatUnlockDate = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// --- SEPARATE THE COMPONENT THAT USES useSearchParams ---
function CoursesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCourseId = searchParams.get('courseId');

  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    async function fetchRoadmap() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setUserProfile(profile);

        // Fetch targeted course or fallback to most recent
        let query = supabase
          .from('enrollments')
          .select('course_id, courses(*)')
          .eq('student_id', localUser.id)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: false });

        if (targetCourseId) {
          query = query.eq('course_id', targetCourseId);
        }

        const { data: enrollmentData, error: enrollError } = await query.limit(1);

        if (enrollError) throw enrollError;

        const enrollment = enrollmentData?.[0];

        if (enrollment) {
          const rawCourse = enrollment.courses as any;
          setCourseData(Array.isArray(rawCourse) ? rawCourse[0] : rawCourse);

          const { data: modulesData } = await supabase
            .from('modules')
            .select(`*, missions (*)`)
            .eq('course_id', enrollment.course_id)
            .order('order_index', { ascending: true });

          const { data: techArchive } = await supabase.from('tech_archive').select('mission_id').eq('student_id', localUser.id);
          const completedMissions = new Set((techArchive || []).map(t => t.mission_id));

          const { data: quizAttempts } = await supabase.from('quiz_attempts').select('module_id, passed, score').eq('student_id', localUser.id);
          
          const quizMap = (quizAttempts || []).reduce((acc: any, curr: any) => {
            if (!acc[curr.module_id]) acc[curr.module_id] = { passed: false, bestScore: 0 };
            if (curr.passed) acc[curr.module_id].passed = true;
            if (curr.score > acc[curr.module_id].bestScore) acc[curr.module_id].bestScore = curr.score;
            return acc;
          }, {});

          if (modulesData) {
            let globalPrevComplete = true; 
            let activeModId: string | null = null;
            let totalMissions = 0;
            let totalCompleted = 0;

            const processed = modulesData.map((mod: any) => {
              const moduleQuiz = quizMap[mod.id] || { passed: false, bestScore: 0 };
              const isQuizPassed = moduleQuiz.passed;
              const bestScore = moduleQuiz.bestScore;

              // --- MODULE LEVEL CHECKS ---
              const modConfig = safeParse(mod.module_config);
              const modIsPublished = mod.is_published !== false && modConfig.is_published !== false && (mod.status || '').toLowerCase() !== 'draft';
              
              const modUnlockDate = mod.unlock_date ? new Date(mod.unlock_date) : null;
              const modIsDateLocked = modUnlockDate && modUnlockDate > new Date();

              // Determine base accessibility of the entire Module Accordion
              let modBaseStatus = 'locked';
              if (isQuizPassed) modBaseStatus = 'completed';
              else if (!modIsPublished) modBaseStatus = 'standby';
              else if (modIsDateLocked) modBaseStatus = 'scheduled';
              else if (globalPrevComplete) modBaseStatus = 'unlocked';
              
              // Set active module to the first unlocked one we find
              if (modBaseStatus === 'unlocked' && !activeModId) activeModId = mod.id;

              const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);
              let prevMissionInModuleDone = true; 

              const processedMissions = sortedMissions.map((m: any) => {
                totalMissions++;
                const isDone = completedMissions.has(m.id);
                if (isDone) totalCompleted++;
                
                // --- MISSION LEVEL CHECKS ---
                const mConfig = safeParse(m.mission_config);
                const missionIsPublished = m.is_published !== false && mConfig.is_published !== false && (m.status || '').toLowerCase() !== 'draft';
                const mUnlockDate = m.unlock_date ? new Date(m.unlock_date) : null;
                const mIsDateLocked = mUnlockDate && mUnlockDate > new Date();
                
                const isEffectivelyPublished = modIsPublished && missionIsPublished;
                const isEffectivelyDateLocked = modIsDateLocked || mIsDateLocked;
                
                let status = 'locked';
                if (isDone) {
                  status = 'completed';
                } else if (!isEffectivelyPublished) {
                  status = 'standby'; 
                } else if (isEffectivelyDateLocked) {
                  status = 'scheduled';
                  m.displayDate = modIsDateLocked ? mod.unlock_date : m.unlock_date; // Pass down the date for the UI
                } else if (globalPrevComplete && prevMissionInModuleDone) {
                  status = 'unlocked';
                }

                prevMissionInModuleDone = isDone;
                return { ...m, status };
              });

              const allMissionsDone = processedMissions.length > 0 && processedMissions.every((m: any) => m.status === 'completed');
              
              let quizStatus = 'locked';
              if (isQuizPassed) quizStatus = 'completed';
              else if (!modIsPublished) quizStatus = 'standby';
              else if (modIsDateLocked) quizStatus = 'scheduled';
              else if (allMissionsDone) quizStatus = 'unlocked';

              globalPrevComplete = isQuizPassed; 

              return { 
                ...mod,
                modBaseStatus, // Track the overall accessibility of the accordion wrapper
                missions: processedMissions, 
                quiz: { status: quizStatus, passed: isQuizPassed, bestScore } 
              };
            });

            setModules(processed);
            setCompletionStats({ completed: totalCompleted, total: totalMissions });
            setOpenModuleId(activeModId || (processed.length > 0 ? processed[0].id : null));
          }
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    }
    fetchRoadmap();
  }, [router, targetCourseId]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: isEngineer ? "Engineer" : "Technician",
      code: isEngineer ? "ENG-02" : "TECH-01",
      accentColor: isEngineer ? "#4ade80" : "#60a5fa",
      floor: isEngineer ? 1000 : 0
    },
    nextLevel: { name: isEngineer ? "Senior Engineer" : "Engineer", xpRequired: isEngineer ? 2500 : 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617]">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 relative z-10 pb-12 md:pb-24">
          
          {/* =========================================
              HEADER SECTION (MOBILE OPTIMIZED)
              ========================================= */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
            <div className="flex items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
              <Link href="/student/dashboard" className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl shrink-0 mt-1 md:mt-0">
                <ChevronLeft size={18} className="md:w-5 md:h-5" />
              </Link>
              <div className="flex-1">
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-0.5 md:mb-1">Course_Roadmap</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words pr-2">
                  {courseData?.title || 'Unknown Sector'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <div className="flex-1 md:flex-none bg-white/5 p-4 md:px-6 md:py-4 rounded-[20px] md:rounded-3xl border border-white/10 flex items-center justify-between md:justify-start md:gap-4 shadow-xl">
                <div className="text-left md:text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total_XP</p>
                  <p className="text-xl md:text-2xl font-black text-white italic leading-none">{currentXP}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shrink-0">
                  <Zap size={16} fill="currentColor" className="md:w-5 md:h-5" />
                </div>
              </div>

              <div className="flex-1 md:flex-none bg-white/5 p-4 md:px-6 md:py-4 rounded-[20px] md:rounded-3xl border border-white/10 flex items-center justify-between md:justify-start md:gap-4 shadow-xl">
                <div className="text-left md:text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Uplinks</p>
                  <p className="text-xl md:text-2xl font-black text-white italic leading-none">{completionStats.completed}/{completionStats.total}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                  <BarChart3 size={16} className="md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-4 md:space-y-6">
            {modules.length === 0 ? (
              <div className="relative bg-[#020617] border border-white/5 rounded-[32px] md:rounded-[56px] text-center shadow-2xl overflow-hidden group min-h-[400px] md:min-h-[500px] flex flex-col items-center justify-center mt-6 md:mt-12">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-1000">
                  <span className="text-[5rem] sm:text-[6rem] md:text-[10rem] font-black text-white whitespace-nowrap -rotate-12 italic tracking-tighter">
                    CLASSIFIED
                  </span>
                </div>

                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-10 md:h-14 bg-fuchsia-500/10 border-y border-fuchsia-500/20 -rotate-12 backdrop-blur-sm flex items-center justify-center gap-4 md:gap-8 shadow-[0_0_50px_rgba(217,70,239,0.15)]">
                      {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-fuchsia-400 font-black text-[8px] md:text-[10px] uppercase tracking-[0.4em] flex items-center gap-4 md:gap-8 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]">
                          ROADMAP SECURED <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                        </span>
                      ))}
                  </div>
                </div>

                <div className="relative z-10 space-y-4 md:space-y-6 flex flex-col items-center backdrop-blur-md bg-[#020617]/70 p-6 md:p-14 rounded-[24px] md:rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-[90%] md:max-w-lg mx-auto">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-[#0f172a] border border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                     <div className="absolute inset-0 border border-fuchsia-500/30 rounded-2xl md:rounded-3xl animate-ping opacity-20" />
                     <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-fuchsia-400" />
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-white drop-shadow-lg leading-none">Awaiting Clearance</h2>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-sm mx-auto">
                      Your training roadmap is currently classified. Sectors and missions will populate here once Command authorizes your curriculum.
                    </p>
                  </div>
                  <Link href="/student/dashboard" className="px-6 md:px-8 py-3.5 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-all mt-2 md:mt-4 inline-block">
                    Return to Dashboard
                  </Link>
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-40 bg-fuchsia-500/10 blur-[100px] -rotate-12 pointer-events-none z-0" />
              </div>
            ) : (
              modules.map((mod) => {
                const isOpen = openModuleId === mod.id;
                const isClickable = mod.modBaseStatus === 'unlocked' || mod.modBaseStatus === 'completed';

                return (
                  <div key={mod.id} className={`bg-white/[0.02] border border-white/5 rounded-[28px] md:rounded-[40px] overflow-hidden transition-all shadow-2xl ${isClickable ? '' : 'opacity-80'}`}>
                    
                    {/* ENFORCED MODULE ACCORDION HEADER (MOBILE OPTIMIZED) */}
                    <button 
                      onClick={() => isClickable && setOpenModuleId(isOpen ? null : mod.id)} 
                      className={`w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-8 transition-all text-left ${isClickable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div className="flex items-start md:items-center gap-3 md:gap-4 w-full md:w-auto">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black border shrink-0 text-sm md:text-base ${mod.modBaseStatus === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : isClickable ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                          M{mod.order_index}
                        </div>
                        <div className="mt-[-2px] md:mt-0 flex-1">
                          <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tighter text-white leading-tight drop-shadow-md pr-2">{mod.title}</h2>
                          <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 leading-snug">{mod.description}</p>
                        </div>
                      </div>

                      {/* DYNAMIC LOCK STATUS BADGES */}
                      <div className="shrink-0 mt-1 md:mt-0 self-end md:self-auto">
                        {isClickable ? (
                          isOpen ? <ChevronUp className="text-slate-500 w-5 h-5 md:w-6 md:h-6" /> : <ChevronDown className="text-slate-500 w-5 h-5 md:w-6 md:h-6" />
                        ) : mod.modBaseStatus === 'scheduled' ? (
                          <div className="flex items-center gap-1.5 md:gap-2 text-amber-500 bg-amber-500/10 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-amber-500/20">
                            <CalendarClock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Unlocks {formatUnlockDate(mod.unlock_date)}</span>
                          </div>
                        ) : mod.modBaseStatus === 'standby' ? (
                          <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
                            <Clock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Standby</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Encrypted</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* ONLY RENDER INTERIOR IF OPENED */}
                    {isOpen && isClickable && (
                      <div className="p-4 sm:p-5 md:p-8 pt-0 grid gap-3 md:gap-4 pl-10 md:pl-20 border-l-2 border-blue-500/20 ml-10 md:ml-14 mb-5 md:mb-8">
                        {mod.missions.map((m: any) => (
                          <div key={m.id} className={`relative p-5 md:p-6 rounded-[20px] md:rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 ${m.status === 'locked' || m.status === 'standby' || m.status === 'scheduled' ? 'bg-white/5 border-white/5 opacity-60' : m.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]'}`}>
                            <div className={`absolute -left-[31px] md:-left-[71px] w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center border-[3px] md:border-4 border-[#020617] ${m.status === 'completed' ? 'bg-green-400' : m.status === 'locked' || m.status === 'standby' || m.status === 'scheduled' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                              {m.status === 'completed' ? <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#020617]" /> : m.status === 'locked' ? <Lock className="w-2 h-2 md:w-2.5 md:h-2.5 text-[#020617]" /> : m.status === 'standby' || m.status === 'scheduled' ? <Clock className="w-2 h-2 md:w-2.5 md:h-2.5 text-[#020617]" /> : <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#020617] rounded-full" />}
                            </div>
                            <div className="space-y-1">
                              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] ${m.status === 'completed' ? 'text-green-400' : m.status === 'standby' ? 'text-slate-400' : m.status === 'scheduled' ? 'text-amber-500' : m.status === 'locked' ? 'text-slate-500' : 'text-blue-400'}`}>Milestone_{m.order_index}</span>
                              <h3 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter leading-tight drop-shadow-md pr-2">{m.title}</h3>
                            </div>
                            
                            {/* DYNAMIC MISSION BUTTON STATES */}
                            {m.status === 'scheduled' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-amber-500/10 text-amber-500/80 border border-amber-500/20 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <CalendarClock size={14} /> Unlocks {formatUnlockDate(m.displayDate)}
                              </button>
                            ) : m.status === 'standby' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <Clock size={14} /> Standby
                              </button>
                            ) : m.status === 'locked' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <Lock size={14} /> Encrypted
                              </button>
                            ) : (
                              <button onClick={() => window.location.href = `/student/lesson/${m.id}`} className={`w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest transition-all shrink-0 flex justify-center items-center ${m.status === 'completed' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>
                                {m.status === 'completed' ? 'Review Archive' : 'Enter Mission'}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* MODULE QUIZ / CHECKPOINT */}
                        <div className={`relative p-5 md:p-8 mt-4 md:mt-6 rounded-[24px] md:rounded-[32px] border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 ${mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'bg-white/5 border-white/5 opacity-50' : mod.quiz?.status === 'completed' ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]'}`}>
                          <div className={`absolute -left-[33px] md:-left-[71px] w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center border-[3px] md:border-4 border-[#020617] ${mod.quiz?.status === 'completed' ? 'bg-yellow-400' : mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                            {mod.quiz?.status === 'completed' ? <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#020617]" /> : mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? <Clock className="w-3 h-3 md:w-3 md:h-3 text-[#020617]" /> : mod.quiz?.status === 'locked' ? <Lock className="w-3 h-3 md:w-3 md:h-3 text-[#020617]" /> : <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#020617]" />}
                          </div>
                          <div className="space-y-1">
                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] ${mod.quiz?.status === 'completed' ? 'text-yellow-400' : mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'text-slate-500' : 'text-blue-400'}`}>Knowledge_Uplink</span>
                            <h3 className="text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter leading-tight drop-shadow-md">Level-Up Checkpoint</h3>
                            {mod.quiz?.status === 'completed' && <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-yellow-400 mt-2">Best Score: {mod.quiz?.bestScore}%</p>}
                          </div>
                          
                          {mod.quiz?.status === 'scheduled' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-6 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-amber-500/10 text-amber-500/80 border border-amber-500/20 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <CalendarClock size={14} /> Unlocks {formatUnlockDate(mod.unlock_date)}
                            </button>
                          ) : mod.quiz?.status === 'standby' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <Clock size={14} /> Standby
                            </button>
                          ) : mod.quiz?.status === 'locked' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <Lock size={14} /> Encrypted
                            </button>
                          ) : (
                            <button onClick={() => window.location.href = `/student/quiz/${mod.id}`} className={`w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest transition-all shrink-0 flex justify-center items-center ${mod.quiz?.status === 'completed' ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/30' : 'bg-blue-500 text-black hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>
                              {mod.quiz?.status === 'completed' ? 'Review Checkpoint' : 'Start Checkpoint'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
          
          {/* =========================================
              DASHBOARD FOOTER (GLOBAL)
              ========================================= */}
          <footer className="mt-12 md:mt-20 border-t border-white/5 pt-8 md:pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy" width={80} height={26} className="opacity-50" unoptimized />
               <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Pioneer Interface</span>
             </div>
             <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">© 2026 RAD Academy. All Systems Nominal.</p>
          </footer>

        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}

// --- WRAP THE CONTENT IN SUSPENSE FOR NEXT.JS BUILD ---
export default function CourseRoadmapPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    }>
      <CoursesContent />
    </Suspense>
  );
}