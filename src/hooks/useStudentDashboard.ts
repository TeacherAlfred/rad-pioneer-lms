import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { calculateEventXp } from "@/lib/xp-engine";

export function useStudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Roster & Course States
  const [allEnrollments, setAllEnrollments] = useState<any[]>([]);
  const [nextLiveSession, setNextLiveSession] = useState<any | null>(null);
  
  // Stats
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });
  const [todayXP, setTodayXP] = useState(0);
  const [progressStats, setProgressStats] = useState({
    courseTotalModules: 0, courseCompletedModules: 0,
    currentModuleTitle: "",
    moduleTotalMissions: 0, moduleCompletedMissions: 0
  });

  // Daily Claim
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // FOMO Timer
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    async function initializeDashboard() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      const userId = localUser.id;

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profile) setUserProfile(profile);
        
        // Daily Claim Check
        const todayStr = new Date().toDateString();
        if (localStorage.getItem(`daily_claim_${userId}_${todayStr}`)) {
          setDailyClaimed(true);
        }
        
        // Fetch Today's XP
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: xpLogs } = await supabase
          .from('xp_logs')
          .select('amount')
          .eq('student_id', userId) 
          .gte('created_at', todayStart.toISOString());
        setTodayXP((xpLogs || []).reduce((acc, curr) => acc + curr.amount, 0));

        // Fetch Next SQL Lesson
        const thresholdDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: upcomingLessons } = await supabase
          .from('lesson_schedule')
          .select('start_time, topic, delivery_mode, location_or_link, teacher_id')
          .eq('student_id', userId)
          .gte('start_time', thresholdDate)
          .order('start_time', { ascending: true })
          .limit(1);

        if (upcomingLessons && upcomingLessons.length > 0) {
          const lesson = upcomingLessons[0];

          // Count siblings sharing the same teacher + start_time to detect a small-group lesson,
          // without ever fetching the other students' names/profiles.
          const { count: groupCount } = await supabase
            .from('lesson_schedule')
            .select('id', { count: 'exact', head: true })
            .eq('teacher_id', lesson.teacher_id)
            .eq('start_time', lesson.start_time);

          setNextLiveSession({
            date: lesson.start_time,
            topic: lesson.topic,
            type: lesson.delivery_mode || 'in-person',
            location: lesson.location_or_link || 'Centurion Main Lab',
            link: lesson.delivery_mode === 'online' ? lesson.location_or_link : '',
            groupSize: groupCount || 1
          });
        }

        // Fetch Enrollments
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id, status, active_task, sandbox_state, courses(*)')
          .eq('student_id', userId);
        
        if (enrollmentsData && enrollmentsData.length > 0) {
          setAllEnrollments(enrollmentsData);
          await autoSyncPointer(userId, enrollmentsData[0].course_id, enrollmentsData[0].active_task);
        }
      } catch (err) {
        console.error("DASHBOARD_INIT_ERROR:", err);
      } finally {
        setLoading(false);
      }
    }

    async function autoSyncPointer(userId: string, courseId: string, currentPointer: any) {
      // (This is your exact same progress math logic, just moved out of the component)
      const { data: techArchive } = await supabase.from('tech_archive').select('mission_id').eq('student_id', userId);
      const completedMissionIds = (techArchive || []).map(t => t.mission_id);

      const { data: quizAttempts } = await supabase.from('quiz_attempts').select('module_id').eq('student_id', userId).eq('passed', true);
      const passedModuleIds = (quizAttempts || []).map(q => q.module_id);

      const { data: modules } = await supabase
        .from('modules')
        .select('*, missions(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      let calculatedTask: any = null;
      let totalMissions = 0, totalCompleted = 0;
      let activeModTitle = "", activeModTotalMissions = 0, activeModCompletedMissions = 0;

      if (modules) {
        for (const mod of modules) {
          const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);
          const isModComplete = passedModuleIds.includes(mod.id);

          if (!isModComplete && !calculatedTask) {
             activeModTitle = mod.title;
             activeModTotalMissions = sortedMissions.length;
          }

          for (const m of sortedMissions) {
            totalMissions++;
            const isDone = completedMissionIds.includes(m.id);
            if (isDone) totalCompleted++;

            if (!isModComplete && !calculatedTask) {
               if (isDone) activeModCompletedMissions++;
               if (!isDone) {
                 calculatedTask = { type: 'mission', id: m.id, title: m.title, moduleTitle: mod.title, moduleDesc: m.description || mod.description, moduleVideo: m.video_url || mod.video_url };
               }
            }
          }

          if (!isModComplete && !calculatedTask) {
             calculatedTask = { type: 'checkpoint', id: mod.id, title: 'Module Checkpoint', moduleTitle: mod.title, moduleDesc: mod.description || "Master the concepts of this sector to advance!", moduleVideo: mod.video_url };
          }
        }
      }

      setCompletionStats({ completed: totalCompleted, total: totalMissions });
      setProgressStats({
        courseTotalModules: modules?.length || 0,
        courseCompletedModules: passedModuleIds.length,
        currentModuleTitle: activeModTitle,
        moduleTotalMissions: activeModTotalMissions,
        moduleCompletedMissions: activeModCompletedMissions
      });

      if (calculatedTask && (!currentPointer || JSON.stringify(currentPointer) !== JSON.stringify(calculatedTask))) {
        await supabase.from('enrollments').update({ active_task: calculatedTask }).eq('student_id', userId).eq('course_id', courseId);
        setAllEnrollments(prev => prev.map(e => e.course_id === courseId ? { ...e, active_task: calculatedTask } : e));
      } else if (!calculatedTask && currentPointer) {
         await supabase.from('enrollments').update({ active_task: null }).eq('student_id', userId).eq('course_id', courseId);
         setAllEnrollments(prev => prev.map(e => e.course_id === courseId ? { ...e, active_task: null } : e));
      }
    }

    initializeDashboard();
  }, [router]);

  // FOMO Timer
  useEffect(() => {
    const targetDate = new Date("2026-05-08T23:59:59+02:00").getTime();
    const interval = setInterval(() => {
      const difference = targetDate - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClaimDaily = async () => {
    if (dailyClaimed || isClaiming || !userProfile) return;
    setIsClaiming(true);
    try {
      const xpToAdd = await calculateEventXp(10);
      const newXp = (userProfile.xp || 0) + xpToAdd;
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

  const handleDisableGuide = async () => {
    if (!userProfile) return;
    const { error } = await supabase.from('profiles').update({ show_welcome_guide: false }).eq('id', userProfile.id);
    if (!error) setUserProfile({ ...userProfile, show_welcome_guide: false });
    return !error;
  };

  const metadata = useMemo(() => {
    if (!userProfile?.metadata) return {};
    try {
      let parsed = typeof userProfile.metadata === 'string' ? JSON.parse(userProfile.metadata) : userProfile.metadata;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Catch double stringification
      return parsed;
    } catch (e) { return {}; }
  }, [userProfile]);

  return {
    loading,
    userProfile,
    metadata,
    allEnrollments,
    nextLiveSession,
    completionStats,
    todayXP,
    progressStats,
    dailyClaimed,
    isClaiming,
    handleClaimDaily,
    handleDisableGuide,
    timeLeft
  };
}