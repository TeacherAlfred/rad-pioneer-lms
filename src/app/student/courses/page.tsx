"use client";

import { useEffect, useState, Suspense } from "react";
import { 
  ChevronLeft, Lock, CheckCircle2, Loader2, 
  Zap, BarChart3, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";

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

              const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);
              
              let prevMissionInModuleDone = true; 

              const processedMissions = sortedMissions.map((m: any) => {
                totalMissions++;
                const isDone = completedMissions.has(m.id);
                if (isDone) totalCompleted++;
                
                const status = isDone ? 'completed' : (globalPrevComplete && prevMissionInModuleDone ? 'unlocked' : 'locked');
                
                if (status === 'unlocked' && !activeModId) activeModId = mod.id;

                prevMissionInModuleDone = isDone;
                return { ...m, status };
              });

              const allMissionsDone = processedMissions.length > 0 && processedMissions.every((m: any) => m.status === 'completed');
              const quizStatus = isQuizPassed ? 'completed' : (allMissionsDone ? 'unlocked' : 'locked');
              
              if (quizStatus === 'unlocked' && !activeModId) activeModId = mod.id;

              globalPrevComplete = isQuizPassed; 

              return { 
                ...mod, 
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
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617] pb-24">
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-12 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="flex items-center gap-6">
              <Link href="/student/dashboard" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl">
                <ChevronLeft size={20} />
              </Link>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Course_Roadmap</p>
                <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">{courseData?.title || 'Unknown Sector'}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 flex items-center gap-4 shadow-xl">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total_XP</p>
                  <p className="text-2xl font-black text-white italic leading-none">{currentXP}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                  <Zap size={20} fill="currentColor" />
                </div>
              </div>

              <div className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 flex items-center gap-4 shadow-xl">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Uplinks</p>
                  <p className="text-2xl font-black text-white italic leading-none">{completionStats.completed}/{completionStats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <BarChart3 size={20} />
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-6">
            {modules.length === 0 ? (
              <div className="relative bg-[#020617] border border-white/5 rounded-[56px] text-center shadow-2xl overflow-hidden group min-h-[500px] flex flex-col items-center justify-center mt-12">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-1000">
                  <span className="text-[6rem] md:text-[10rem] font-black text-white whitespace-nowrap -rotate-12 italic tracking-tighter">
                    CLASSIFIED
                  </span>
                </div>

                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-14 bg-fuchsia-500/10 border-y border-fuchsia-500/20 -rotate-12 backdrop-blur-sm flex items-center justify-center gap-8 shadow-[0_0_50px_rgba(217,70,239,0.15)]">
                      {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-fuchsia-400 font-black text-[10px] uppercase tracking-[0.4em] flex items-center gap-8 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]">
                          ROADMAP SECURED <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                        </span>
                      ))}
                  </div>
                </div>

                <div className="relative z-10 space-y-6 flex flex-col items-center backdrop-blur-md bg-[#020617]/70 p-8 md:p-14 rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-lg mx-4">
                  <div className="w-24 h-24 bg-[#0f172a] border border-white/10 rounded-3xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                     <div className="absolute inset-0 border border-fuchsia-500/30 rounded-3xl animate-ping opacity-20" />
                     <ShieldAlert size={40} className="text-fuchsia-400" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-white drop-shadow-lg leading-none">Awaiting Clearance</h2>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                      Your training roadmap is currently classified. Sectors and missions will populate here once Command authorizes your curriculum.
                    </p>
                  </div>
                  <Link href="/student/dashboard" className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-all mt-4 inline-block">
                    Return to Dashboard
                  </Link>
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-40 bg-fuchsia-500/10 blur-[100px] -rotate-12 pointer-events-none z-0" />
              </div>
            ) : (
              modules.map((mod) => {
                const isOpen = openModuleId === mod.id;
                return (
                  <div key={mod.id} className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden transition-all shadow-2xl">
                    <button onClick={() => setOpenModuleId(isOpen ? null : mod.id)} className="w-full flex items-center justify-between p-8 hover:bg-white/5 transition-all text-left">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black border ${mod.quiz?.passed ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>M{mod.order_index}</div>
                        <div>
                          <h2 className="text-xl font-black uppercase italic tracking-tight text-white">{mod.title}</h2>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{mod.description}</p>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                    </button>

                    {isOpen && (
                      <div className="p-8 pt-0 grid gap-4 pl-12 md:pl-20 border-l-2 border-blue-500/20 ml-14 mb-8">
                        {mod.missions.map((m: any) => (
                          <div key={m.id} className={`relative p-6 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${m.status === 'locked' ? 'bg-white/5 border-white/5 opacity-50' : m.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]'}`}>
                            <div className={`absolute -left-[39px] md:-left-[71px] w-6 h-6 rounded-full flex items-center justify-center border-4 border-[#020617] ${m.status === 'completed' ? 'bg-green-400' : m.status === 'locked' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                              {m.status === 'completed' ? <CheckCircle2 size={12} className="text-[#020617]" /> : m.status === 'locked' ? <Lock size={10} className="text-[#020617]" /> : <div className="w-2 h-2 bg-[#020617] rounded-full" />}
                            </div>
                            <div className="space-y-1">
                              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${m.status === 'completed' ? 'text-green-400' : 'text-blue-400'}`}>Milestone_{m.order_index}</span>
                              <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">{m.title}</h3>
                            </div>
                            {m.status !== 'locked' && (
                              <button onClick={() => window.location.href = `/student/lesson/${m.id}`} className={`px-8 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all ${m.status === 'completed' ? 'bg-white/10 text-white' : 'bg-white text-black hover:scale-105 shadow-xl'}`}>{m.status === 'completed' ? 'Review Archive' : 'Enter Mission'}</button>
                            )}
                          </div>
                        ))}

                        <div className={`relative p-8 mt-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${mod.quiz?.status === 'locked' ? 'bg-white/5 border-white/5 opacity-50' : mod.quiz?.status === 'completed' ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]'}`}>
                          <div className={`absolute -left-[39px] md:-left-[71px] w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#020617] ${mod.quiz?.status === 'completed' ? 'bg-yellow-400' : mod.quiz?.status === 'locked' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                            {mod.quiz?.status === 'completed' ? <ShieldCheck size={16} className="text-[#020617]" /> : mod.quiz?.status === 'locked' ? <Lock size={12} className="text-[#020617]" /> : <ShieldAlert size={16} className="text-[#020617]" />}
                          </div>
                          <div className="space-y-1">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${mod.quiz?.status === 'completed' ? 'text-yellow-400' : 'text-blue-400'}`}>Knowledge_Uplink</span>
                            <h3 className="text-3xl font-black italic uppercase text-white tracking-tight">Level-Up Checkpoint</h3>
                            {mod.quiz?.status === 'completed' && <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mt-2">Best Score: {mod.quiz?.bestScore}%</p>}
                          </div>
                          {mod.quiz?.status !== 'locked' && (
                            <button onClick={() => window.location.href = `/student/quiz/${mod.id}`} className={`px-8 py-5 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all ${mod.quiz?.status === 'completed' ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/30' : 'bg-blue-500 text-black hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>{mod.quiz?.status === 'completed' ? 'Review Checkpoint' : 'Start Checkpoint'}</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
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