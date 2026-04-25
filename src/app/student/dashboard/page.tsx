"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, ArrowUpRight,
  Map, Zap, BarChart3, ShieldCheck, Sparkles, X, MonitorPlay, AlertTriangle, BookOpen, ChevronRight, ChevronLeft, User, Calendar, MapPin, Video, Mail, MessageCircle, Shield, Gift, BatteryCharging, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

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
  const [allEnrollments, setAllEnrollments] = useState<any[]>([]); 
  
  // Header Stats (Macro)
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });
  const [todayXP, setTodayXP] = useState(0); 

  // Course Card Stats (Micro/ABA Goal-Gradient)
  const [progressStats, setProgressStats] = useState({
    courseTotalModules: 0,
    courseCompletedModules: 0,
    currentModuleTitle: "",
    moduleTotalMissions: 0,
    moduleCompletedMissions: 0
  });
  
  // ABA: Behavioral Momentum State
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
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

  // ABA: High-P Request (Daily Bonus Claim)
  const handleClaimDaily = async () => {
    if (dailyClaimed || isClaiming || !userProfile) return;
    setIsClaiming(true);
    
    try {
      const newXp = (userProfile.xp || 0) + 10;
      await supabase.from('profiles').update({ xp: newXp }).eq('id', userProfile.id);
      
      const todayStr = new Date().toDateString();
      localStorage.setItem(`daily_claim_${userProfile.id}_${todayStr}`, "true");
      
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.3 } });
      
      setTodayXP(prev => prev + 10);
      setUserProfile({ ...userProfile, xp: newXp });
      setDailyClaimed(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClaiming(false);
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
        if (profile) setUserProfile(profile);
        
        // Check High-P Sequence status
        const todayStr = new Date().toDateString();
        if (localStorage.getItem(`daily_claim_${userId}_${todayStr}`)) {
          setDailyClaimed(true);
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
          
          // Auto-sync pointer for the primary course to update stats
          const primaryEnrollment = enrollmentsData[0];
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
      
      // Top Header Stats (Macro)
      let totalMissions = 0;
      let totalCompleted = 0;

      // Course Card Stats (Micro)
      let totalModulesCount = modules?.length || 0;
      let completedModulesCount = passedModuleIds.length;
      let activeModTitle = "";
      let activeModTotalMissions = 0;
      let activeModCompletedMissions = 0;

      if (modules) {
        for (const mod of modules) {
          const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);
          const isModComplete = passedModuleIds.includes(mod.id);

          // Mark active module details for the UI
          if (!isModComplete && !calculatedTask) {
             activeModTitle = mod.title;
             activeModTotalMissions = sortedMissions.length;
          }

          for (const m of sortedMissions) {
            totalMissions++;
            const isDone = completedMissionIds.includes(m.id);
            if (isDone) totalCompleted++;

            // If this is the active module, count its specific progress
            if (!isModComplete && !calculatedTask) {
               if (isDone) activeModCompletedMissions++;

               if (!isDone) {
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
          }

          if (!isModComplete && !calculatedTask) {
             calculatedTask = {
               type: 'checkpoint',
               id: mod.id,
               title: 'Module Checkpoint',
               moduleTitle: mod.title,
               moduleDesc: mod.description || "Master the concepts of this sector to advance!",
               moduleVideo: mod.video_url
             };
          }
        }
      }

      setCompletionStats({ completed: totalCompleted, total: totalMissions });
      setProgressStats({
        courseTotalModules: totalModulesCount,
        courseCompletedModules: completedModulesCount,
        currentModuleTitle: activeModTitle,
        moduleTotalMissions: activeModTotalMissions,
        moduleCompletedMissions: activeModCompletedMissions
      });

      if (calculatedTask) {
        if (!currentPointer || JSON.stringify(currentPointer) !== JSON.stringify(calculatedTask)) {
          await supabase.from('enrollments').update({ active_task: calculatedTask }).eq('student_id', userId).eq('course_id', courseId);
          setAllEnrollments(prev => prev.map(e => e.course_id === courseId ? { ...e, active_task: calculatedTask } : e));
        }
      } else if (!calculatedTask && currentPointer) {
         await supabase.from('enrollments').update({ active_task: null }).eq('student_id', userId).eq('course_id', courseId);
         setAllEnrollments(prev => prev.map(e => e.course_id === courseId ? { ...e, active_task: null } : e));
      }
    }

    initializeDashboard();
  }, [router]);

  const metadata = useMemo(() => {
    if (!userProfile?.metadata) return {};
    try {
      return typeof userProfile.metadata === 'string' ? JSON.parse(userProfile.metadata) : userProfile.metadata;
    } catch (e) {
      return {};
    }
  }, [userProfile]);

  const dynamicNextLesson = useMemo(() => {
    let allLessons: any[] = [];

    if (metadata.schedule && Array.isArray(metadata.schedule)) {
      allLessons = [...metadata.schedule];
    }

    if (metadata.next_lesson && metadata.next_lesson.date) {
      allLessons.push({
        id: "legacy_next_lesson",
        date: metadata.next_lesson.date,
        delivery: metadata.next_lesson.type || metadata.learning_mode,
        link: metadata.next_lesson.link,
        location: metadata.next_lesson.location,
        topic: "Scheduled Session"
      });
    }

    if (allLessons.length === 0) return null;

    const now = new Date().getTime();
    const threshold = now - (2 * 60 * 60 * 1000); 

    const upcoming = allLessons
      .filter((lesson: any) => new Date(lesson.date).getTime() >= threshold)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length > 0) {
      const lesson = upcoming[0];
      return {
        date: lesson.date,
        topic: lesson.topic,
        type: lesson.delivery?.toLowerCase() || metadata.learning_mode?.toLowerCase() || 'online',
        location: lesson.location || 'Centurion Main Lab',
        link: lesson.link || ''
      };
    }
    
    return null;
  }, [metadata]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = { xp: currentXP, level: isEngineer ? 2 : 1, currentLevel: { name: isEngineer ? "Engineer" : "Technician", floor: isEngineer ? 1000 : 0 }, nextLevel: { xpRequired: 2500 } };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617]">
        <div className="max-w-4xl lg:max-w-5xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 relative z-10 pb-12 md:pb-20">
          
          {/* =========================================
              HEADER SECTION
              ========================================= */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
            <div className="space-y-2 md:space-y-3 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words">
                Welcome back, <br className="md:hidden" />
                <span className="text-blue-400">{userProfile?.display_name?.split(' ')[0] || "Pioneer"}!</span>
              </h1>
              
              {/* ABA: Behavioral Momentum - The Easy Win */}
              <div className="pt-2">
                {!dailyClaimed ? (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    onClick={handleClaimDaily}
                    disabled={isClaiming}
                    className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-yellow-300"
                  >
                    {isClaiming ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                    Claim Daily +10 XP!
                  </motion.button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs"
                  >
                    <Check size={16} /> Daily XP Secured
                  </motion.div>
                )}
              </div>
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
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Missions</p>
                  <p className="text-xl md:text-2xl font-black text-white italic leading-none">{completionStats.completed}/{completionStats.total}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                  <BarChart3 size={16} className="md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          </header>

          {/* =========================================
              UNIFIED COMMAND HUD (RANK + LOGISTICS FOOTER)
              ========================================= */}
          <section className="bg-gradient-to-br from-[#1e293b] to-[#020617] rounded-[32px] md:rounded-[48px] border border-white/10 relative overflow-hidden shadow-2xl flex flex-col">
            <Rocket className="absolute -right-4 -bottom-4 md:-right-8 md:-top-8 w-40 h-40 md:w-64 md:h-64 text-white/5 -rotate-12 pointer-events-none" />
            
            <div className="relative z-10 p-6 md:p-10 pb-0 md:pb-0">
              <PioneerXPBar 
                xp={currentXP} 
                todayXP={todayXP} 
                rankName={stats.currentLevel.name} 
                floor={stats.currentLevel.floor} 
                ceiling={stats.nextLevel.xpRequired} 
              />
            </div>

            {(metadata?.teacher || dynamicNextLesson) && (
              <div className="relative z-10 mt-8 bg-black/40 border-t border-white/5 px-6 md:px-10 py-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
                  
                  {dynamicNextLesson && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-6 flex-1">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-0.5 flex items-center gap-1.5"><Calendar size={12}/> Next Live Session</p>
                        <p className="text-sm md:text-base font-bold text-white">
                          {new Date(dynamicNextLesson.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} <span className="text-slate-500 mx-1">/</span> {new Date(dynamicNextLesson.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      <div className="sm:ml-auto">
                        {dynamicNextLesson.type === 'in-person' ? (
                          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl">
                            <MapPin size={12} className="shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">{dynamicNextLesson.location}</span>
                          </div>
                        ) : dynamicNextLesson.link ? (
                          <a href={dynamicNextLesson.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-black px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                            <Video size={14} className="shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Join Meeting</span>
                          </a>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-slate-500/70 cursor-not-allowed" title="Meeting link will be provided closer to the session">
                            <Video size={16} className="shrink-0" />
                            <span className="text-xs font-bold">Link Pending</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {metadata.teacher && dynamicNextLesson && (
                    <div className="hidden md:block w-px h-10 bg-white/10" />
                  )}

                  {metadata.teacher && (
                    <div className="flex items-center justify-between gap-6 flex-1 pt-4 border-t border-white/5 md:pt-0 md:border-0">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 mb-0.5 flex items-center gap-1.5"><Shield size={12}/> Your Coach</p>
                        <p className="text-sm md:text-base font-bold text-white truncate max-w-[150px]">
                          {metadata.teacher.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {metadata.teacher.email && (
                          <a href={`mailto:${metadata.teacher.email}`} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all">
                            <Mail size={14} />
                          </a>
                        )}
                        {metadata.teacher.whatsapp && (
                          <a href={`https://wa.me/${metadata.teacher.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 flex items-center justify-center text-green-400 transition-all">
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </section>

          {/* =========================================
              UNIFIED LIBRARY: COURSES + NEXT LESSON
              ========================================= */}
          {allEnrollments.length > 0 && (
            <section className="space-y-6 md:space-y-8 pt-4 md:pt-6">
              <div className="flex items-center gap-2.5 md:gap-3 px-2 md:px-4 border-b border-white/5 pb-3 md:pb-4">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-white italic text-left">Your Current Course</h3>
              </div>
              
              <div className="space-y-6 md:space-y-8">
                {allEnrollments.map((enrollment) => {
                  const courseData = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
                  if (!courseData) return null;
                  
                  const activeTask = enrollment.active_task as ActiveTaskData;

                  return (
                    <div 
                      key={enrollment.course_id} 
                      className="relative bg-[#0f172a] border border-blue-500/30 rounded-[32px] md:rounded-[48px] overflow-hidden flex flex-col md:flex-row shadow-[0_0_40px_rgba(59,130,246,0.1)] group"
                    >
                      {/* --- LEFT SIDE: COURSE PRECEDENCE --- */}
                      <div className="p-6 md:p-10 md:w-[55%] flex flex-col justify-between relative z-10 border-b md:border-b-0 md:border-r border-white/5 bg-[#020617]/60">
                        
                        <div className="space-y-6 md:space-y-8 w-full pr-4">
                          <div>
                            <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-[0.9] drop-shadow-sm">
                              {courseData.title}
                            </h2>
                          </div>

                          {/* ==============================================
                              DUAL PROGRESS METER (ABA Goal-Gradient UX)
                              ============================================== */}
                          <div className="bg-black/40 border border-white/5 rounded-2xl p-5 md:p-6 space-y-6 shadow-inner">
                            
                            {/* 1. MACRO: Course Progress (Continuous Bar) */}
                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                  <Map size={12} className="text-blue-500" /> Overall Course Mastery
                                </span>
                                <span className="text-xs font-black text-blue-400">
                                  {progressStats.courseCompletedModules} / {progressStats.courseTotalModules} Sectors
                                </span>
                              </div>
                              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(progressStats.courseCompletedModules / Math.max(1, progressStats.courseTotalModules)) * 100}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 relative"
                                >
                                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]" />
                                </motion.div>
                              </div>
                            </div>

                            {/* 2. MICRO: Module Progress (Discrete Energy Cells) */}
                            <div className="pt-5 border-t border-white/5">
                              {/* Layout fix: added gap-3, min-w-0 for truncation, and shrink-0 for the counter */}
                              <div className="flex justify-between items-center mb-3 gap-3">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Zap size={12} className="text-emerald-500 shrink-0" /> 
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                                    {progressStats.currentModuleTitle || "System Initialization"}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-emerald-400 shrink-0 whitespace-nowrap">
                                  {progressStats.moduleCompletedMissions} / {progressStats.moduleTotalMissions} Core
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 md:gap-2">
                                {/* Map through total missions and render discrete glowing nodes */}
                                {Array.from({ length: progressStats.moduleTotalMissions }).map((_, i) => {
                                  const isComplete = i < progressStats.moduleCompletedMissions;
                                  const isActive = i === progressStats.moduleCompletedMissions;
                                  
                                  return (
                                    <div 
                                      key={i} 
                                      className={`h-4 md:h-5 flex-1 rounded-sm border transition-all duration-500 ${
                                        isComplete 
                                          ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                                          : isActive
                                            ? 'bg-blue-500/20 border-blue-400/50 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                            : 'bg-slate-800/50 border-slate-700/50'
                                      }`}
                                    />
                                  );
                                })}
                                {/* Boss Level / Checkpoint Node at the end */}
                                <div 
                                  className={`h-5 md:h-6 w-8 flex items-center justify-center rounded-md border transition-all duration-500 ml-1 ${
                                    progressStats.moduleCompletedMissions === progressStats.moduleTotalMissions
                                      ? 'bg-yellow-500 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse'
                                      : 'bg-slate-800/50 border-slate-700/50'
                                  }`}
                                >
                                  <ShieldCheck size={12} className={progressStats.moduleCompletedMissions === progressStats.moduleTotalMissions ? 'text-black' : 'text-slate-600'} />
                                </div>
                              </div>
                              
                              {/* Encouragement Text (ABA Reinforcement) */}
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-3 text-center">
                                {progressStats.moduleCompletedMissions === progressStats.moduleTotalMissions 
                                  ? "Energy cells full! Ready for Boss Level!" 
                                  : `Charge ${progressStats.moduleTotalMissions - progressStats.moduleCompletedMissions} more cells to unlock the Boss Level!`}
                              </p>
                            </div>

                          </div>
                        </div>

                        {/* ABA: Errorless Learning - Subdue the alternative option */}
                        <Link href="/student/courses" className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-slate-600 hover:text-slate-300 transition-colors group/link w-full">
                          <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <Map size={14} /> See full course map
                          </span>
                          <ChevronRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      </div>

                      {/* --- RIGHT SIDE: THE MAIN CTA (ERRORLESS LEARNING) --- */}
                      <div className="md:w-[45%] relative bg-[#020617] flex flex-col overflow-hidden min-h-[260px] md:min-h-0">
                        {activeTask ? (
                          <>
                            <div className="absolute inset-0 z-0">
                              {activeTask.moduleVideo ? (
                                <video 
                                  src={activeTask.moduleVideo}
                                  autoPlay loop muted playsInline 
                                  className="w-full h-full object-cover opacity-30 md:opacity-40" 
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/60 to-transparent" />
                            </div>

                            <div className="relative z-10 p-6 md:p-8 flex flex-col h-full items-center justify-center text-center">
                              
                              <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                  Current Mission
                                </span>
                              </div>

                              <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
                                {activeTask.title}
                              </h3>

                              {/* ABA: Errorless Learning - MASSIVE, pulsing, unmissable button */}
<Link 
  href={courseData.title === 'Robotics Pioneer Bootcamp' ? '/student/bootcamp' : activeTask.type === 'checkpoint' ? `/student/quiz/${activeTask.id}` : `/student/lesson/${activeTask.id}`} 
  className={`w-full py-5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 relative overflow-hidden group shadow-2xl ${
    courseData.title === 'Robotics Pioneer Bootcamp'
      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]'
      : activeTask.type === 'checkpoint' 
        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:shadow-[0_0_40px_rgba(245,158,11,0.6)]' 
        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-[0_0_40px_rgba(59,130,246,0.6)]'
  }`}
>
  {/* Light sweep animation */}
  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
  
  {courseData.title === 'Robotics Pioneer Bootcamp' ? (
    <>
      <Zap className="w-6 h-6 animate-pulse" />
      <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Enter Logic Lab</span>
    </>
  ) : activeTask.type === 'checkpoint' ? (
    <>
      <ShieldCheck className="w-6 h-6 animate-pulse" />
      <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Launch Boss Level</span>
    </>
  ) : (
    <>
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Play fill="currentColor" className="w-4 h-4 ml-1" />
      </div>
      <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Launch Mission</span>
    </>
  )}
</Link>
                            </div>
                          </>
                        ) : (
                          /* ABA: Tolerance Training (Reframing the wait) */
                          <div className="relative z-10 p-6 md:p-8 flex flex-col items-center justify-center h-full text-center bg-black/40">
                            <motion.div 
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-4"
                            >
                              <BatteryCharging className="w-8 h-8 text-emerald-400" />
                            </motion.div>
                            <span className="text-sm font-black uppercase text-emerald-400 tracking-widest">Hyper-Sleep Active</span>
                            <span className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest max-w-[200px]">
                              You have cleared all sectors! Rest and recharge your robot for the next drop.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
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

      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:block">
        <ProfileSidebar />
      </div>

      {/* --- MOBILE SIDE TAB --- */}
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

      {/* --- MOBILE SIDEBAR DRAWER --- */}
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
                 <ProfileSidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </DashboardClientWrapper>
  );
}