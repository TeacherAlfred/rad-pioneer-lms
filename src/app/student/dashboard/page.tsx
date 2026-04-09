"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, Clock,
  Map, Zap, BarChart3, ShieldCheck, Sparkles, X, MonitorPlay, AlertTriangle, BookOpen, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ActiveTaskData {
  type: 'mission' | 'checkpoint';
  id: string;
  title: string;
  moduleTitle: string;
  moduleDesc: string;
  moduleVideo: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Course & Task States
  const [activeTask, setActiveTask] = useState<ActiveTaskData | null>(null);
  const [courseTitle, setCourseTitle] = useState("Academy Uplink");
  const [allEnrollments, setAllEnrollments] = useState<any[]>([]); // NEW: Store all courses
  
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });
  
  // Modal & Confirmation States
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);

  const handleDisableGuide = async () => {
    if (!userProfile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ show_welcome_guide: false })
      .eq('id', userProfile.id);
      
    if (!error) {
      setShowGuideModal(false);
      setIsConfirmingDisable(false);
      setUserProfile({ ...userProfile, show_welcome_guide: false });
    }
  };

  useEffect(() => {
    async function initializeDashboard() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      const userId = localUser.id;

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profile) {
          setUserProfile(profile);
        }
        
        // --- UPDATED: Fetch ALL enrollments instead of just one ---
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id, active_task, courses(*)')
          .eq('student_id', userId);
        
        if (enrollmentsData && enrollmentsData.length > 0) {
          setAllEnrollments(enrollmentsData);
          
          // Use the first enrolled course as the "Primary" Hero focus
          const primaryEnrollment = enrollmentsData[0];
          const rawCourse = primaryEnrollment.courses as any;
          setCourseTitle(Array.isArray(rawCourse) ? rawCourse[0]?.title : rawCourse?.title || "Course");

          if (primaryEnrollment.active_task) {
            setActiveTask(primaryEnrollment.active_task as ActiveTaskData);
          }

          // Auto-sync pointer for the primary course
          await autoSyncPointer(userId, primaryEnrollment.course_id, primaryEnrollment.active_task);
        }
      } catch (err) {
        console.error("DASHBOARD_INIT_ERROR:", err);
      } finally {
        setLoading(false);
      }
    }

    async function autoSyncPointer(userId: string, courseId: string, currentPointer: any) {
      const { data: techArchive } = await supabase.from('tech_archive').select('mission_id').eq('student_id', userId);
      const completedMissionIds = (techArchive || []).map(t => t.mission_id);

      const { data: quizAttempts } = await supabase.from('quiz_attempts').select('module_id').eq('student_id', userId).eq('passed', true);
      const passedModuleIds = (quizAttempts || []).map(q => q.module_id);

      const { data: modules } = await supabase
        .from('modules')
        .select('*, missions(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      let calculatedTask: ActiveTaskData | null = null;
      let totalMissions = 0;
      let totalCompleted = 0;

      if (modules) {
        for (const mod of modules) {
          const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);

          for (const m of sortedMissions) {
            totalMissions++;
            const isDone = completedMissionIds.includes(m.id);
            if (isDone) totalCompleted++;

            if (!isDone && !calculatedTask) {
              calculatedTask = {
                type: 'mission',
                id: m.id,
                title: m.title,
                moduleTitle: mod.title,
                moduleDesc: m.description || mod.description, 
                moduleVideo: m.video_url || mod.video_url 
              };
            }
          }

          if (!passedModuleIds.includes(mod.id) && !calculatedTask) {
            calculatedTask = {
              type: 'checkpoint',
              id: mod.id,
              title: 'Knowledge Uplink',
              moduleTitle: mod.title,
              moduleDesc: mod.description || "Master the concepts of this sector to advance!",
              moduleVideo: mod.video_url
            };
          }
        }
      }

      setCompletionStats({ completed: totalCompleted, total: totalMissions });

      if (calculatedTask) {
        setActiveTask(calculatedTask);
        if (!currentPointer || JSON.stringify(currentPointer) !== JSON.stringify(calculatedTask)) {
          await supabase.from('enrollments').update({ active_task: calculatedTask }).eq('student_id', userId).eq('course_id', courseId);
        }
      } else if (!calculatedTask && currentPointer) {
         setActiveTask(null);
         await supabase.from('enrollments').update({ active_task: null }).eq('student_id', userId).eq('course_id', courseId);
      }
    }

    initializeDashboard();
  }, [router]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = { xp: currentXP, level: isEngineer ? 2 : 1, currentLevel: { name: isEngineer ? "Engineer" : "Technician", floor: isEngineer ? 1000 : 0 }, nextLevel: { xpRequired: 2500 } };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617] pb-20">
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-12 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
                Hello, <span className="text-blue-400">{userProfile?.display_name || "Pioneer"}</span>
              </h1>
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

          <section className="bg-gradient-to-br from-[#1e293b] to-[#020617] p-10 rounded-[48px] border border-white/10 relative overflow-hidden shadow-2xl">
            <Rocket className="absolute -right-8 -bottom-8 size-48 text-white/5 -rotate-12 pointer-events-none" />
            <div className="relative z-10 space-y-6"><PioneerXPBar xp={currentXP} rankName={stats.currentLevel.name} floor={stats.currentLevel.floor} ceiling={stats.nextLevel.xpRequired} /></div>
          </section>

          {/* =========================================
              THE HERO: ACTIVE MISSION (CONTINUE LEARNING)
              ========================================= */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {activeTask?.type === 'checkpoint' ? 'System_Checkpoint_Pending' : 'Active_Mission_Uplink'}
              </h3>
              <Link href="/student/courses" className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:underline transition-all">
                <Map size={14} /> View Roadmap
              </Link>
            </div>

            {activeTask ? (
              <div className="relative rounded-[56px] overflow-hidden border border-white/10 bg-[#020617] shadow-2xl">
                <div className="relative h-64 md:h-80 w-full overflow-hidden bg-slate-900">
                  {activeTask.moduleVideo ? (
                    <video 
                      key={activeTask.moduleVideo} 
                      src={activeTask.moduleVideo}
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover opacity-60" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-600/20 to-purple-600/20">
                       <Rocket size={64} className="text-white/10 animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
                  <div className="absolute top-6 left-8">
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black/60 text-white border-white/20 backdrop-blur-md italic">
                      {activeTask.type === 'checkpoint' ? 'Final Verification' : activeTask.moduleTitle}
                    </span>
                  </div>
                </div>

                <div className="px-8 md:px-14 pb-12 -mt-16 relative z-10">
                  <div className="flex flex-col md:flex-row items-end justify-between gap-8">
                    <div className="space-y-4 text-left max-w-xl">
                      <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-[0.85]">
                        {activeTask.title}
                      </h2>
                      <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-5 rounded-3xl">
                        <Sparkles className="text-blue-400 shrink-0 mt-1" size={20} />
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">
                          {activeTask.moduleDesc || "Your next challenge awaits! Complete this mission to unlock new creator powers."}
                        </p>
                      </div>
                    </div>

                    <Link 
                      href={activeTask.type === 'checkpoint' ? `/student/quiz/${activeTask.id}` : `/student/lesson/${activeTask.id}`} 
                      className={`w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl hover:scale-110 shrink-0 group ${
                        activeTask.type === 'checkpoint' ? 'bg-yellow-500 text-black' : 'bg-white text-slate-950'
                      }`}
                    >
                      {activeTask.type === 'checkpoint' ? <ShieldCheck size={48} /> : <Play fill="currentColor" size={44} className="ml-1" />}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative bg-[#020617] border border-white/5 rounded-[56px] text-center shadow-2xl overflow-hidden group min-h-[400px] flex flex-col items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000">
                  <span className="text-[8rem] md:text-[12rem] font-black text-white whitespace-nowrap -rotate-12 italic tracking-tighter">
                    COMING SOON
                  </span>
                </div>
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-14 bg-blue-500/10 border-y border-blue-500/20 -rotate-12 backdrop-blur-sm flex items-center justify-center gap-8 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                      {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] flex items-center gap-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                          DEPLOYING SOON <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        </span>
                      ))}
                  </div>
                </div>
                <div className="relative z-10 space-y-6 flex flex-col items-center backdrop-blur-md bg-[#020617]/60 p-8 md:p-12 rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-lg mx-4">
                  <div className="w-20 h-20 bg-[#0f172a] border border-white/10 rounded-2xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                     <div className="absolute inset-0 border border-blue-500/30 rounded-2xl animate-ping opacity-20" />
                     <Clock size={32} className="text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white drop-shadow-lg">Courses Locked</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Your portal is currently empty. Courses and missions will appear here once they are initialized by Command.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* =========================================
              NEW: THE LIBRARY (ALL ENROLLED COURSES)
              ========================================= */}
          {allEnrollments.length > 0 && (
            <section className="space-y-6 pt-6">
              <div className="flex items-center gap-3 px-4 border-b border-white/5 pb-4">
                <BookOpen size={16} className="text-blue-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Active Directives (Courses)</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allEnrollments.map((enrollment) => {
                  const courseData = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
                  if (!courseData) return null;

                  return (
                    <Link 
                      key={enrollment.course_id} 
                      href="/student/courses" // Routes to their master roadmap view
                      className="group bg-white/[0.02] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all flex flex-col justify-between min-h-[200px]"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">
                            {enrollment.status === 'active' ? 'Uplink Active' : 'Offline'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase italic tracking-tighter leading-tight group-hover:text-blue-400 transition-colors">
                            {courseData.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                            {courseData.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-slate-400 group-hover:text-white transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-widest">Enter Sector</span>
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* --- MISSION BRIEFING POPUP --- */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {setShowGuideModal(false); setIsConfirmingDisable(false);}}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <MonitorPlay className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Mission Briefing</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Interface Calibration Guide</p>
                  </div>
                </div>
                <button onClick={() => {setShowGuideModal(false); setIsConfirmingDisable(false);}} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="aspect-video bg-black relative">
                <iframe 
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1" 
                  title="Pioneer Dashboard Walkthrough"
                  allowFullScreen
                />
              </div>

              <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02]">
                <p className="text-slate-400 text-sm font-medium italic">Calibration recommended for all Pioneers.</p>
                
                {!isConfirmingDisable ? (
                  <button 
                    onClick={() => setIsConfirmingDisable(true)}
                    className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                  >
                    Don't show this again
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsConfirmingDisable(false)}
                      className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDisableGuide}
                      className="px-8 py-4 bg-red-500/10 border border-red-500/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                    >
                      <AlertTriangle size={14} /> Are you sure?
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}