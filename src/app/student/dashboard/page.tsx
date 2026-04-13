"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, Clock,
  Map, Zap, BarChart3, ShieldCheck, Sparkles, X, MonitorPlay, AlertTriangle, BookOpen, ChevronRight, ChevronLeft, User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
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
  const [allEnrollments, setAllEnrollments] = useState<any[]>([]); 
  
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });
  const [todayXP, setTodayXP] = useState(0); 
  
  // Modal & Sidebar States
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
        
        // --- Fetch XP earned today ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { data: xpLogs } = await supabase
          .from('xp_logs')
          .select('amount')
          .eq('student_id', userId) 
          .gte('created_at', todayStart.toISOString());
          
        const earnedToday = (xpLogs || []).reduce((acc, curr) => acc + curr.amount, 0);
        setTodayXP(earnedToday);

        // Fetch ALL enrollments
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id, status, active_task, courses(*)')
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
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617]">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 relative z-10 pb-12 md:pb-20">
          
          {/* =========================================
              HEADER SECTION
              ========================================= */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
            <div className="space-y-1 md:space-y-2 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words">
                Hello, <br className="md:hidden" />
                <span className="text-blue-400">{userProfile?.display_name || "Pioneer"}</span>
              </h1>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
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

          {/* =========================================
              RANK & XP SECTION
              ========================================= */}
          <section className="bg-gradient-to-br from-[#1e293b] to-[#020617] p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-white/10 relative overflow-hidden shadow-2xl">
            <Rocket className="absolute -right-4 -bottom-4 md:-right-8 md:-bottom-8 w-32 h-32 md:w-48 md:h-48 text-white/5 -rotate-12 pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <PioneerXPBar 
                xp={currentXP} 
                todayXP={todayXP} 
                rankName={stats.currentLevel.name} 
                floor={stats.currentLevel.floor} 
                ceiling={stats.nextLevel.xpRequired} 
              />
            </div>
          </section>

          {/* =========================================
              THE HERO: ACTIVE MISSION
              ========================================= */}
          <section className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between px-2 md:px-4">
              <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
                {activeTask?.type === 'checkpoint' ? 'System_Checkpoint_Pending' : 'Active_Mission_Uplink'}
              </h3>
              <Link href="/student/courses" className="flex items-center gap-1.5 md:gap-2 text-blue-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:underline transition-all">
                <Map size={12} className="md:w-3.5 md:h-3.5" /> View Roadmap
              </Link>
            </div>

            {activeTask ? (
              <div className="relative rounded-[32px] md:rounded-[56px] overflow-hidden border border-white/10 bg-[#020617] shadow-2xl flex flex-col">
                
                {/* Image/Video Header Area */}
                <div className="relative h-48 md:h-80 w-full overflow-hidden bg-slate-900 shrink-0">
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
                       <Rocket size={48} className="md:w-16 md:h-16 text-white/10 animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
                  
                  {/* Module Badge - Fixed max width and wrapping */}
                  <div className="absolute top-4 left-4 right-4 md:top-6 md:left-8 md:right-auto pointer-events-none pr-4">
                    <div className="inline-block px-3 py-1.5 md:px-4 md:py-1.5 rounded-xl md:rounded-full text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border bg-black/60 text-white border-white/20 backdrop-blur-md italic leading-snug md:leading-normal max-w-[90%] md:max-w-full text-left break-words whitespace-normal">
                      {activeTask.type === 'checkpoint' ? 'Final Verification' : activeTask.moduleTitle}
                    </div>
                  </div>
                </div>

                {/* Content Area - Fixed Margin and Text Sizing */}
                <div className="px-5 md:px-14 pb-8 md:pb-12 -mt-8 md:-mt-16 relative z-10 flex-1 flex flex-col">
                  <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 md:gap-8 flex-1 w-full">
                    
                    <div className="space-y-3 md:space-y-4 text-left w-full md:max-w-xl">
                      <h2 className="text-2xl sm:text-3xl md:text-6xl font-black text-white tracking-tighter italic uppercase leading-[0.95] md:leading-[0.85] drop-shadow-md break-words">
                        {activeTask.title}
                      </h2>
                      <div className="flex gap-2.5 md:gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-inner">
                        <Sparkles className="text-blue-400 shrink-0 mt-0.5 md:mt-1 w-4 h-4 md:w-5 md:h-5" />
                        <p className="text-slate-300 text-xs md:text-sm leading-relaxed font-medium">
                          {activeTask.moduleDesc || "Your next challenge awaits! Complete this mission to unlock new creator powers."}
                        </p>
                      </div>
                    </div>

                    <Link 
                      href={activeTask.type === 'checkpoint' ? `/student/quiz/${activeTask.id}` : `/student/lesson/${activeTask.id}`} 
                      className={`w-16 h-16 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all shadow-xl md:shadow-2xl hover:scale-105 md:hover:scale-110 shrink-0 group self-end md:self-auto ${
                        activeTask.type === 'checkpoint' ? 'bg-yellow-500 text-black' : 'bg-white text-slate-950'
                      }`}
                    >
                      {activeTask.type === 'checkpoint' ? (
                        <ShieldCheck className="w-8 h-8 md:w-12 md:h-12" />
                      ) : (
                        <Play fill="currentColor" className="w-7 h-7 md:w-11 md:h-11 ml-1 md:ml-1.5" />
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative bg-[#020617] border border-white/5 rounded-[32px] md:rounded-[56px] text-center shadow-2xl overflow-hidden group min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000">
                  <span className="text-[5rem] sm:text-[8rem] md:text-[12rem] font-black text-white whitespace-nowrap -rotate-12 italic tracking-tighter">
                    COMING SOON
                  </span>
                </div>
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-10 md:h-14 bg-blue-500/10 border-y border-blue-500/20 -rotate-12 backdrop-blur-sm flex items-center justify-center gap-4 md:gap-8 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                      {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-blue-400 font-black text-[8px] md:text-[10px] uppercase tracking-[0.4em] flex items-center gap-4 md:gap-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                          DEPLOYING SOON <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        </span>
                      ))}
                  </div>
                </div>
                <div className="relative z-10 space-y-4 md:space-y-6 flex flex-col items-center backdrop-blur-md bg-[#020617]/60 p-6 md:p-12 rounded-[24px] md:rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-[90%] md:max-w-lg mx-auto">
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-[#0f172a] border border-white/10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                     <div className="absolute inset-0 border border-blue-500/30 rounded-xl md:rounded-2xl animate-ping opacity-20" />
                     <Clock className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight text-white drop-shadow-lg">Courses Locked</h2>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                      Your portal is currently empty. Courses and missions will appear here once they are initialized by Command.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* =========================================
              THE LIBRARY (YOUR COURSES)
              ========================================= */}
          {allEnrollments.length > 0 && (
            <section className="space-y-4 md:space-y-6 pt-4 md:pt-6">
              <div className="flex items-center gap-2.5 md:gap-3 px-2 md:px-4 border-b border-white/5 pb-3 md:pb-4">
                <BookOpen className="w-4 h-4 md:w-4 md:h-4 text-blue-500" />
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white italic">Your Courses</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {allEnrollments.map((enrollment) => {
                  const courseData = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
                  if (!courseData) return null;

                  return (
                    <Link 
                      key={enrollment.course_id} 
                      href="/student/courses" 
                      className="group bg-white/[0.02] border border-white/5 rounded-[24px] md:rounded-[32px] p-5 md:p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all flex flex-col justify-between min-h-[160px] md:min-h-[200px]"
                    >
                      <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 md:px-2.5 py-1 rounded border text-[7px] md:text-[8px] font-black uppercase tracking-widest ${
                            enrollment.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {enrollment.status === 'active' ? 'Registered' : 'Not Registered'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter leading-tight group-hover:text-blue-400 transition-colors">
                            {courseData.title}
                          </h4>
                          <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 md:mt-2 line-clamp-2 leading-relaxed">
                            {courseData.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-white/5 flex items-center justify-between text-slate-400 group-hover:text-white transition-colors">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Enter Sector</span>
                        <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* =========================================
              DASHBOARD FOOTER
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

      {/* --- MISSION BRIEFING POPUP --- */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
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
              className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-5 md:p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-blue-500/20 rounded-lg md:rounded-xl border border-blue-500/30">
                    <MonitorPlay className="text-blue-400 w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl font-black text-white uppercase italic tracking-tighter leading-none">Mission Briefing</h3>
                    <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">Interface Calibration Guide</p>
                  </div>
                </div>
                <button onClick={() => {setShowGuideModal(false); setIsConfirmingDisable(false);}} className="text-slate-500 hover:text-white transition-colors p-2">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
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

              <div className="p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 bg-white/[0.02]">
                <p className="text-slate-400 text-xs md:text-sm font-medium italic text-center md:text-left">Calibration recommended for all Pioneers.</p>
                
                {!isConfirmingDisable ? (
                  <button 
                    onClick={() => setIsConfirmingDisable(true)}
                    className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                  >
                    Don't show this again
                  </button>
                ) : (
                  <div className="flex w-full md:w-auto items-center justify-center gap-2 md:gap-3">
                    <button 
                      onClick={() => setIsConfirmingDisable(false)}
                      className="px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-500 hover:text-white flex-1 md:flex-none text-center"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDisableGuide}
                      className="px-4 md:px-8 py-3 md:py-4 bg-red-500/10 border border-red-500/40 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Sure?
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDEBAR (ALWAYS VISIBLE ON LARGE SCREENS) --- */}
      <div className="hidden lg:block">
        {/* We mount this normally without the mobile props to keep TS happy */}
        <ProfileSidebar />
      </div>

      {/* --- MOBILE SIDE TAB (FLOATING HANDLE) --- */}
      {!isMobileSidebarOpen && (
        <div className="lg:hidden fixed top-1/2 right-0 -translate-y-1/2 z-40">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex items-center justify-center p-3 pl-4 bg-blue-600/20 backdrop-blur-xl border border-r-0 border-blue-500/30 rounded-l-2xl shadow-[-5px_0_20px_rgba(59,130,246,0.15)] text-blue-400 hover:text-white hover:bg-blue-500/30 transition-all group"
          >
            <div className="flex flex-col items-center gap-1">
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <User size={18} />
            </div>
          </button>
        </div>
      )}

      {/* --- MOBILE SIDEBAR DRAWER (SLIDES IN ON SMALL SCREENS) --- */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm lg:hidden"
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-[110] w-[85%] max-w-sm bg-[#0f172a] shadow-2xl border-l border-white/10 lg:hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Pioneer Status</span>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar relative">
                 {/* Re-mounts the sidebar component so it fetches fresh data when opened */}
                 <ProfileSidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </DashboardClientWrapper>
  );
}