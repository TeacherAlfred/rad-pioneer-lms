"use client";

import { useEffect, useState } from "react";
import { 
  ChevronLeft, Lock, CheckCircle2, Play, Loader2, 
  Zap, BarChart3, ChevronDown, ChevronUp 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";

export default function CourseRoadmapPage() {
  const router = useRouter();
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

        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('course_id, courses(*)')
          .eq('student_id', localUser.id)
          .maybeSingle();

        if (enrollment) {
          const rawCourse = enrollment.courses as any;
          setCourseData(Array.isArray(rawCourse) ? rawCourse[0] : rawCourse);

          const { data: modulesData } = await supabase
            .from('modules')
            .select(`*, missions (*, tech_archive(student_id))`)
            .eq('course_id', enrollment.course_id)
            .order('order_index', { ascending: true });

          if (modulesData) {
            let prevComplete = true; 
            let activeModId: string | null = null;
            let totalMissions = 0;
            let totalCompleted = 0;

            const processed = modulesData.map((mod: any) => {
              const sortedMissions = mod.missions.sort((a: any, b: any) => a.order_index - b.order_index);
              
              const processedMissions = sortedMissions.map((m: any) => {
                totalMissions++;
                const isDone = m.tech_archive?.some((a: any) => 
                    String(a.student_id).toLowerCase() === String(localUser.id).toLowerCase()
                );
                if (isDone) totalCompleted++;
                
                const status = isDone ? 'completed' : (prevComplete ? 'unlocked' : 'locked');
                
                // If this is the first unlocked mission, this is the "active" module
                if (status === 'unlocked' && !activeModId) {
                  activeModId = mod.id;
                }

                prevComplete = isDone;
                return { ...m, status };
              });

              return { ...mod, missions: processedMissions };
            });

            setModules(processed);
            setCompletionStats({ completed: totalCompleted, total: totalMissions });
            // Default open the module containing the active mission
            setOpenModuleId(activeModId || (processed.length > 0 ? processed[0].id : null));
          }
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    fetchRoadmap();
  }, [router]);

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
          
          {/* HEADER WITH XP & UPLINK CARDS (MATCHES DASHBOARD) */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="flex items-center gap-6">
              <Link href="/student/dashboard" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl">
                <ChevronLeft size={20} />
              </Link>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Course_Roadmap</p>
                <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">{courseData?.title}</h1>
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
            {modules.map((mod) => {
              const isOpen = openModuleId === mod.id;
              
              return (
                <div key={mod.id} className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden transition-all shadow-2xl">
                  {/* Module Header - Clickable */}
                  <button 
                    onClick={() => setOpenModuleId(isOpen ? null : mod.id)}
                    className="w-full flex items-center justify-between p-8 hover:bg-white/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-black border border-blue-500/20">
                        M{mod.order_index}
                      </div>
                      <div>
                        <h2 className="text-xl font-black uppercase italic tracking-tight text-white">{mod.title}</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{mod.description}</p>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                  </button>

                  {/* Collapsible Mission Grid */}
                  {isOpen && (
                    <div className="p-8 pt-0 grid gap-4 pl-12 md:pl-20 border-l-2 border-blue-500/20 ml-12 mb-8">
                      {mod.missions.map((m: any) => (
                        <div 
                          key={m.id} 
                          className={`relative p-6 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                            m.status === 'locked' ? 'bg-white/5 border-white/5 opacity-50' : 
                            m.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 
                            'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]'
                          }`}
                        >
                          <div className={`absolute -left-[39px] md:-left-[71px] w-6 h-6 rounded-full flex items-center justify-center border-4 border-[#020617] ${
                            m.status === 'completed' ? 'bg-green-400' : 
                            m.status === 'locked' ? 'bg-slate-700' : 
                            'bg-blue-400 animate-pulse'
                          }`}>
                            {m.status === 'completed' ? <CheckCircle2 size={12} className="text-[#020617]" /> : 
                             m.status === 'locked' ? <Lock size={10} className="text-[#020617]" /> : 
                             <div className="w-2 h-2 bg-[#020617] rounded-full" />}
                          </div>
                          
                          <div className="space-y-1">
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                              m.status === 'completed' ? 'text-green-400' : 'text-blue-400'
                            }`}>Milestone_{m.order_index}</span>
                            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">{m.title}</h3>
                          </div>

                          {m.status !== 'locked' && (
                            <Link 
                              href={`/student/lesson/${m.id}`} 
                              className={`px-8 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all ${
                                m.status === 'completed' ? 'bg-white/10 text-white' : 'bg-white text-black hover:scale-105'
                              }`}
                            >
                              {m.status === 'completed' ? 'Review Archive' : 'Enter Mission'}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}