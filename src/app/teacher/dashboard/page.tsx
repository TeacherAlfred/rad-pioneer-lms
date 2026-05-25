"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, Calendar, Activity, AlertTriangle, Search, Filter, 
  ChevronRight, Target, CalendarIcon, ExternalLink,
  Shield, Clock, Laptop, CheckCircle2, ChevronLeft, CalendarCheck, Loader2, X, Edit2, Save, MapPin, Video,
  Repeat, CheckSquare, Square, UserPlus, Globe, User, LogOut, Trash2, ChevronDown, LayoutDashboard, TrendingUp, Trophy, FileText, Check, XCircle, CalendarRange, Bell,
  CalendarDays,
  Zap,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

// Custom Components
import BulkScheduleManager from "@/components/dashboard/BulkScheduleManager";
import SevenDayHorizon from "@/components/dashboard/SevenDayHorizon";
import AddSingleLessonModal from "@/components/dashboard/AddSingleLessonModal";
import LapsedStudentsTracker from "@/components/dashboard/LapsedStudentsTracker";

import TeacherCatchupQueue from '@/components/TeacherCatchupQueue';

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function TeacherDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadStudentIds, setUnreadStudentIds] = useState<Set<string>>(new Set());
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState(false);
  const [metricDrilldown, setMetricDrilldown] = useState<string | null>(null);
  const [isCatchupModalOpen, setIsCatchupModalOpen] = useState(false);
  const [pendingCatchupsCount, setPendingCatchupsCount] = useState(0);
  const [isBulkScheduleOpen, setIsBulkScheduleOpen] = useState(false);
  const [editingLessonGroup, setEditingLessonGroup] = useState<any | null>(null);
  
  // Single Lesson & Refresh Triggers
  const [addingLessonDate, setAddingLessonDate] = useState<Date | null>(null);
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);
  
  const [students, setStudents] = useState<any[]>([]);
  const [activeCourses, setActiveCourses] = useState<any[]>([]);
  const [educators, setEducators] = useState<any[]>([]); 
  const [availabilities, setAvailabilities] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const [viewScope, setViewScope] = useState<string>('global');
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);

  // --- NEW: CENTRALIZED SQL TODAY METRICS ---
  const [todayClassesCount, setTodayClassesCount] = useState(0);
  const [todayStudentIds, setTodayStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTodayClasses = async () => {
      if (!currentUser) return;
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      let query = supabase
        .from('lesson_schedule')
        .select('student_id, start_time, topic, delivery_mode')
        .gte('start_time', todayStart.toISOString())
        .lt('start_time', todayEnd.toISOString());

      if (viewScope === 'my_roster') {
        query = query.eq('teacher_id', currentUser.id);
      } else if (viewScope !== 'global') {
        query = query.eq('teacher_id', viewScope);
      }

      const { data } = await query;
      
      if (data) {
        const uniqueClasses = new Set<string>();
        const stuIds = new Set<string>();
        data.forEach((lesson: any) => {
          const t = new Date(lesson.start_time).getTime();
          uniqueClasses.add(`${t}-${lesson.topic}-${lesson.delivery_mode}`);
          stuIds.add(lesson.student_id);
        });
        setTodayClassesCount(uniqueClasses.size);
        setTodayStudentIds(stuIds);
      } else {
        setTodayClassesCount(0);
        setTodayStudentIds(new Set());
      }
    };

    fetchTodayClasses();
  }, [viewScope, currentUser, scheduleRefreshTrigger]);

  // ----------------------------------------
  // XP AWARD LOGIC
  // ----------------------------------------
  const handleAwardXP = async (submission: any, awardedXp: number, bonusXp: number, justification: string) => {
    const finalAwarded = isNaN(awardedXp) ? 0 : awardedXp;
    const finalBonus = isNaN(bonusXp) ? 0 : bonusXp;

    const maxBonus = Math.floor((submission.potential_xp || 0) * 0.1);
    if (finalBonus > maxBonus) {
      return showToast(`Bonus cannot exceed ${maxBonus} XP (10% limit)`, "error");
    }

    const totalToGive = finalAwarded + finalBonus;

    setPendingSubmissions(prev => prev.map(s => 
      s.id === submission.id 
        ? { ...s, review_status: 'reviewed', xp_earned: (s.xp_earned || 0) + totalToGive, metadata: { ...s.metadata, teacher_notes: justification } }
        : s
    ));

    try {
      const { data: profile } = await supabase.from('profiles').select('xp, metadata').eq('id', submission.student_id).single();
      
      if (profile) {
        const currentXp = profile.xp || 0;
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        
        let noteLog = `[${new Date().toLocaleDateString()}] Awarded ${finalAwarded} XP`;
        if (finalBonus > 0) noteLog += ` + ${finalBonus} Bonus XP`;
        noteLog += ` for project: ${submission.project_title || submission.title}\n`;
        if (justification) noteLog += `Teacher Note: ${justification}\n`;

        meta.admin_notes = noteLog + (meta.admin_notes ? `\n${meta.admin_notes}` : "");

        await supabase.from('profiles').update({ 
          xp: currentXp + totalToGive,
          metadata: meta 
        }).eq('id', submission.student_id);
      }

      if (submission.source_table === 'tutorial_submissions') {
        const { data: updatedRow, error: archiveError } = await supabase
          .from('tutorial_submissions')
          .update({ 
            status: 'reviewed',
            xp_earned: (submission.xp_earned || 0) + totalToGive,
            bonus_xp: (submission.bonus_xp || 0) + finalBonus
          })
          .eq('id', submission.id)
          .select();

        if (archiveError) throw archiveError;
      } else {
        const { data: updatedRow, error: archiveError } = await supabase
          .from('tech_archive')
          .update({
            review_status: 'reviewed',
            xp_earned: (submission.xp_earned || 0) + totalToGive, 
            teacher_feedback: justification,      
            teacher_xp_awarded: (submission.teacher_xp_awarded || 0) + finalBonus        
          })
          .eq('id', submission.id)
          .select();

        if (archiveError) throw archiveError;
      }

      showToast(`Awarded ${totalToGive} XP to student!`, "success");
      fetchDashboardData(true); 
    } catch (err: any) {
      showToast(err.message === "RLS_BLOCKED" ? "Database blocked save. Check RLS policies!" : "Error updating XP.", "error");
      fetchDashboardData(true); 
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  useEffect(() => {
    if (currentUser) {
      setViewScope(currentUser.role === 'admin' ? 'global' : 'my_roster');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchUnread = async () => {
      const { data } = await supabase.from('coach_messages').select('student_id').eq('coach_id', currentUser.id).eq('is_read', false).neq('sender_id', currentUser.id);
      if (data) {
        setUnreadCount(data.length);
        setUnreadStudentIds(new Set(data.map(msg => msg.student_id)));
        if (data.length === 0) setUnreadOnlyFilter(false);
      }
    };
    fetchUnread();
    const channel = supabase.channel('teacher_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_messages', filter: `coach_id=eq.${currentUser.id}` }, () => {
         fetchUnread(); 
      }).subscribe();

    const handleClear = () => fetchUnread();
    window.addEventListener('messagesRead', handleClear);
    return () => { 
      supabase.removeChannel(channel); 
      window.removeEventListener('messagesRead', handleClear);
    };
  }, [currentUser]);

  async function fetchDashboardData(isSilentRefresh = false) {
    if (!isSilentRefresh) setLoading(true);
    try {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      if (profile) setCurrentUser(profile);

      const { count: catchupCount } = await supabase
        .from('catchup_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', localUser.id)
        .eq('status', 'Pending Teacher');
        
      setPendingCatchupsCount(catchupCount || 0);

      const [studentsRes, guardiansRes, coursesRes, enrollmentsRes, educatorsRes, availRes, techArchiveRes, tutSubsRes, missionsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('display_name', { ascending: true }),
        supabase.from('profiles').select('id, display_name, metadata').in('role', ['guardian', 'admin']),
        supabase.from('courses').select('*').eq('is_published', true).order('order_index', { ascending: true }),
        supabase.from('enrollments').select('*, courses(*)'),
        supabase.from('profiles').select('id, display_name').eq('role', 'educator').order('display_name', { ascending: true }),
        supabase.from('teacher_availability').select('*').gte('end_time', new Date().toISOString()).order('start_time', { ascending: true }),
        supabase.from('tech_archive').select('*, profiles!inner(display_name, metadata)').in('review_status', ['pending', 'reviewed']),
        supabase.from('tutorial_submissions').select('*').in('status', ['pending', 'reviewed']),
        supabase.from('missions').select('id, xp_reward, title')
      ]);

      if (coursesRes.data) setActiveCourses(coursesRes.data);
      if (educatorsRes.data) setEducators(educatorsRes.data);
      if (availRes.data) setAvailabilities(availRes.data);
      
      const missionsMap = new Map();
      if (missionsRes.data) {
        missionsRes.data.forEach((m: any) => missionsMap.set(m.id, { xp: m.xp_reward, title: m.title }));
      }

      let combinedSubs: any[] = [];

      if (techArchiveRes.data) {
        const enrichedTech = techArchiveRes.data.map((sub: any) => {
           let max = sub.potential_xp || 0;
           if (max === 0) max = missionsMap.get(sub.mission_id)?.xp || 0;
           return { ...sub, potential_xp: max, source_table: 'tech_archive' }; 
        });
        combinedSubs = [...combinedSubs, ...enrichedTech];
      }

      if (tutSubsRes.data && tutSubsRes.data.length > 0) {
        const studentIds = [...new Set(tutSubsRes.data.map((s: any) => s.student_id))];
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name, metadata').in('id', studentIds);
        
        const profileMap = new Map();
        if (profilesData) {
          profilesData.forEach(p => profileMap.set(p.id, p));
        }

        const enrichedSubs = tutSubsRes.data.map((sub: any) => {
           const missionData = missionsMap.get(sub.mission_id);
           return {
             ...sub,
             title: missionData ? `${missionData.title} (MakeCode Win ${sub.win_index})` : 'MakeCode Submission',
             media_url: sub.share_url, 
             potential_xp: missionData?.xp || 250,
             xp_earned: sub.xp_earned || 0,
             review_status: sub.status,
             profiles: profileMap.get(sub.student_id) || { display_name: 'Unknown Pioneer', metadata: {} },
             source_table: 'tutorial_submissions'
           };
        });
        combinedSubs = [...combinedSubs, ...enrichedSubs];
      }

      const myStudentsSubs = combinedSubs.filter((sub: any) => 
        sub.profiles?.metadata?.teacher?.id === localUser.id
      );
      setPendingSubmissions(myStudentsSubs);

      const enrollmentsMap = new Map<string, string[]>();
      if (enrollmentsRes.data) {
         enrollmentsRes.data.forEach((enr: any) => {
             if (enr.status === 'active') {
                 const cObj: any = enr.courses;
                 const c = Array.isArray(cObj) ? cObj[0] : cObj;
                 if (c && c.title) {
                     const currentCourses = enrollmentsMap.get(enr.student_id) || [];
                     if (!currentCourses.includes(c.title)) {
                         enrollmentsMap.set(enr.student_id, [...currentCourses, c.title]);
                     }
                 }
             }
         });
      }

      const guardiansMap = new Map(guardiansRes.data?.map(g => [g.id, g]) || []);
      
      const mappedStudents = studentsRes.data?.map(s => {
        const guardian: any = guardiansMap.get(s.linked_parent_id) || {};
        const guardianMeta: any = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
        const studentMeta: any = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {});
        
        let age: string | number = "N/A";
        if (s.date_of_birth) {
          const diffMs = Date.now() - new Date(s.date_of_birth).getTime();
          age = Math.abs(new Date(diffMs).getUTCFullYear() - 1970);
        }

        const studentCourses = enrollmentsMap.get(s.id) || [];

        let attendanceString = "No Recent Logins";
        if (studentMeta.current_streak > 0) {
           attendanceString = `${studentMeta.current_streak} Day Streak`;
        } else if (s.last_active_date) {
           const daysSince = Math.floor((new Date().getTime() - new Date(s.last_active_date).getTime()) / (1000 * 3600 * 24));
           if (daysSince === 0) attendanceString = "Active Today";
           else if (daysSince === 1) attendanceString = "Active Yesterday";
           else if (daysSince <= 7) attendanceString = `Active ${daysSince} days ago`;
           else attendanceString = `Last seen ${new Date(s.last_active_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}`;
        }

        return {
          id: s.id,
          linked_parent_id: s.linked_parent_id,
          student_identifier: s.student_identifier,
          name: s.display_name || "Unknown Pioneer",
          age: age,
          course: studentCourses.length > 0 ? studentCourses.join(', ') : "Unassigned", 
          coursesList: studentCourses.length > 0 ? studentCourses : ["Unassigned"],
          delivery_method: studentMeta.learning_mode || "In-person",
          schedule: studentMeta.schedule || [], 
          attendance: attendanceString,
          skillLevel: (s.xp || 0) > 1000 ? "Advanced" : (s.xp || 0) > 500 ? "Intermediate" : "Beginner",
          lastSeen: s.last_active_date ? new Date(s.last_active_date).toLocaleDateString() : "Never",
          scheduledToday: false, 
          status: s.status,
          alerts: studentMeta.medical_notes ? [studentMeta.medical_notes] : [],
          progress: { logic: 0, syntax: 0, hardware: 0 }, 
          guardian: {
            name: guardian.display_name || "No Guardian Linked",
            phone: guardianMeta.phone || "N/A",
            email: guardianMeta.email || "N/A",
            relation: guardianMeta.relation || "Guardian",
            vip: studentMeta.account_tier === 'full'
          },
          teacherId: studentMeta.teacher?.id || null,
          recentNote: studentMeta.admin_notes || "No instructional notes on file."
        };
      }) || [];

      setStudents(mappedStudents);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error.message);
    } finally {
      setLoading(false);
    }
  }

  const enrollInBootcamp = async (studentId: string) => {
    try {
      const { data: course } = await supabase.from('courses').select('id').eq('title', 'Robotics Pioneer Bootcamp').single();
      if (!course) return showToast("Bootcamp course not found in DB.", "error");

      await supabase.from('enrollments').upsert({ student_id: studentId, course_id: course.id, status: 'active' }, { onConflict: 'student_id,course_id' });

      const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', studentId).single();
      const meta = typeof profile?.metadata === 'string' ? JSON.parse(profile.metadata) : (profile?.metadata || {});
      meta.learning_mode = 'In-person';
      meta.interested_programs = ['Robotics Pioneer Bootcamp'];
      
      await supabase.from('profiles').update({ metadata: meta }).eq('id', studentId);
      showToast("Student enrolled successfully!", "success");
      fetchDashboardData();
    } catch (err) {
      showToast("Failed to enroll student.", "error");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("pioneer_session");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const scopedStudents = useMemo(() => {
    if (viewScope === 'global') return students;
    if (viewScope === 'my_roster') return students.filter(s => s.teacherId === currentUser?.id);
    return students.filter(s => s.teacherId === viewScope);
  }, [students, viewScope, currentUser]);

  const scopedAvailabilities = useMemo(() => {
    if (viewScope === 'global') return availabilities;
    const targetId = viewScope === 'my_roster' ? currentUser?.id : viewScope;
    return availabilities.filter(a => a.teacher_id === targetId);
  }, [availabilities, viewScope, currentUser]);

  const scopeName = viewScope === 'my_roster' ? "My" : viewScope === 'global' ? "Global" : educators.find(e => e.id === viewScope)?.display_name?.split(' ')[0] + "'s";

  const handleSaveLessonEdits = async (lessonGroup: any, finalAttendees: any[], newDateISO: string, newDelivery: string, newLogistics: string, wrapUpData: { attendance: Record<string, string>, xp: number, note: string }) => {
    try {
      // JSON BACKWARDS COMPATIBILITY & SQL SYNC
      const originalAttendees = lessonGroup.attendees || [];
      const originalIds = originalAttendees.map((a: any) => a.studentId);
      const finalIds = finalAttendees.map((a: any) => a.studentId);

      const removedIds = originalIds.filter((id: string) => !finalIds.includes(id));
      const keptIds = originalIds.filter((id: string) => finalIds.includes(id));
      const addedIds = finalIds.filter((id: string) => !originalIds.includes(id));

      const isLink = newDelivery === 'online';

      // 1. UPDATE NEW SQL TABLE DIRECTLY
      if (lessonGroup.lessonId) {
          await supabase.from('lesson_schedule').update({
             start_time: newDateISO,
             delivery_mode: newDelivery,
             location_or_link: newLogistics || null
          }).eq('id', lessonGroup.lessonId);
      } else {
         const lessonIdsToUpdate = originalAttendees.map((a:any) => a.lessonId).filter(Boolean);
         if (lessonIdsToUpdate.length > 0) {
            await supabase.from('lesson_schedule').update({
               start_time: newDateISO,
               delivery_mode: newDelivery,
               location_or_link: newLogistics || null
            }).in('id', lessonIdsToUpdate);
         }
      }

      // 2. BACKWARDS COMPATIBILITY
      const updateStudentScheduleOnly = async (studentId: string, mutator: (sched: any[]) => any[]) => {
          const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', studentId).single();
          if(profile) {
              const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
              meta.schedule = mutator(meta.schedule || []);
              await supabase.from('profiles').update({ metadata: meta }).eq('id', studentId);
          }
      };

      await Promise.all([
        ...removedIds.map((id: string) => updateStudentScheduleOnly(id, sched => sched.filter(l => l.id !== originalAttendees.find((a: any) => a.studentId === id)?.lessonId))),
        ...keptIds.map((id: string) => updateStudentScheduleOnly(id, sched => sched.map(l => (l.id === originalAttendees.find((a: any) => a.studentId === id)?.lessonId ? { ...l, date: newDateISO, delivery: newDelivery, link: isLink ? newLogistics : null, location: !isLink ? newLogistics : null } : l)))),
        ...addedIds.map((id: string) => updateStudentScheduleOnly(id, sched => [...sched, { id: Math.random().toString(36).substring(7), date: newDateISO, topic: lessonGroup.topic, course: lessonGroup.course, delivery: newDelivery, link: isLink ? newLogistics : null, location: !isLink ? newLogistics : null, reminders: { parents: true, teacher: true } }]))
      ]);

      if (wrapUpData && Object.keys(wrapUpData.attendance).length > 0) {
        await Promise.all(Object.entries(wrapUpData.attendance).map(async ([studentId, status]) => {
          const { data: profile } = await supabase.from('profiles').select('xp, metadata').eq('id', studentId).single();
          if (profile) {
            let newXp = profile.xp || 0;
            const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
            meta.lessons_scheduled = (meta.lessons_scheduled || 0) + 1;

            if (status === 'present' || status === 'late') {
              newXp += wrapUpData.xp || 0;
              meta.lessons_attended = (meta.lessons_attended || 0) + 1;
              meta.current_streak = (meta.current_streak || 0) + 1;
            } else if (status === 'absent') {
              meta.current_streak = 0; 
            }

            if (wrapUpData.note) {
              const noteDate = new Date().toLocaleDateString('en-ZA');
              meta.admin_notes = `[${noteDate} - ${status.toUpperCase()}] ${wrapUpData.note}\n\n` + (meta.admin_notes || "");
            }

            await supabase.from('profiles').update({ xp: newXp, metadata: meta }).eq('id', studentId);
          }
        }));
      }

      await fetchDashboardData(true);
      showToast("Lesson itinerary updated successfully!", "success");
      setScheduleRefreshTrigger(prev => prev + 1);
    } catch (err) {
      showToast("Failed to update lesson schedule.", "error");
    }
  };

  const metrics = {
    totalStudents: scopedStudents.length,
    activeStreaks: scopedStudents.filter(s => s.attendance.includes('Streak')).length,
    upcomingClasses: todayClassesCount,
    activeAlerts: scopedStudents.filter(s => s.alerts.length > 0).length,
    pendingReviews: pendingSubmissions.filter(s => s.review_status === 'pending').length
  };

  if (loading) return <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-purple-500/30 relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-xs md:text-sm font-black uppercase tracking-widest">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-500">
              <Shield size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Instructional_Command</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">Educator_<span className="text-purple-500">Portal</span></h1>
            <p className="text-slate-400 font-medium mt-2">Welcome back, {currentUser?.display_name || 'Admin'}. You have {metrics.upcomingClasses} class sessions scheduled today.</p>
          </div>

          <div className="flex flex-wrap items-end sm:items-center gap-3">
            {currentUser?.role === 'admin' && (
              <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-slate-300">
                <LayoutDashboard size={14}/> Admin Hub
              </button>
            )}
            
            <div onClick={() => unreadCount > 0 && setUnreadOnlyFilter(!unreadOnlyFilter)} className={`relative p-2.5 rounded-xl border transition-all shadow-sm ${unreadOnlyFilter ? 'bg-purple-500/20 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : unreadCount > 0 ? 'bg-white/5 border-purple-500/30 text-purple-300 cursor-pointer hover:bg-white/10 animate-pulse' : 'bg-white/5 border-white/5 text-slate-500 cursor-not-allowed'}`}>
              <Bell size={16} />
              {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-[#0f172a] shadow-lg">{unreadCount}</span>}
            </div>

            <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />
            <button onClick={handleLogout} className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all"><LogOut size={16} /></button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 pb-6 border-b border-white/5">
           {currentUser?.role === 'admin' ? (
             <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
               <button onClick={() => setViewScope('global')} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === 'global' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}><Globe size={14} /> Global View</button>
               {educators.map(ed => (
                 <button key={ed.id} onClick={() => setViewScope(ed.id)} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === ed.id ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}><User size={14} /> {ed.display_name.split(' ')[0]}</button>
               ))}
             </div>
           ) : (
             <div className="flex bg-[#0f172a] border border-white/10 rounded-2xl p-1 shadow-inner shrink-0">
               <button onClick={() => setViewScope('my_roster')} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewScope === 'my_roster' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}><User size={14} /> My Roster</button>
               <button onClick={() => setViewScope('global')} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewScope === 'global' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}><Globe size={14} /> Global View</button>
             </div>
           )}

           <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
             <button onClick={() => router.push('/teacher/schedule')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all shadow-lg">
               <CalendarIcon size={14}/> Master Schedule
             </button>
             <button onClick={() => router.push('/teacher/progress')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all shadow-lg">
               <TrendingUp size={14}/> Progress Matrix
             </button>
             <button onClick={() => setIsBulkScheduleOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg">
               <CalendarDays size={14}/> Bulk Schedule
             </button>
             <button 
                onClick={() => {
                  setIsCatchupModalOpen(true);
                  // Optionally clear the pulse immediately on click for better UX
                  setPendingCatchupsCount(0); 
                }} 
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                  pendingCatchupsCount > 0 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg hover:bg-amber-500/20'
                }`}
              >
                <Activity size={14}/> Catch-Ups
                
                {/* The Floating Badge */}
                {pendingCatchupsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-[#020617] animate-none">
                    {pendingCatchupsCount}
                  </span>
                )}
              </button>
           </div>
        </div>

        <HeroMetrics metrics={metrics} onDrilldown={setMetricDrilldown} scopeName={scopeName} />

        <SevenDayHorizon 
          viewScope={viewScope} 
          currentUser={currentUser} 
          availabilities={scopedAvailabilities} 
          onEditLesson={setEditingLessonGroup} 
          onAddLesson={(date) => setAddingLessonDate(date)}
          refreshTrigger={scheduleRefreshTrigger}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          <div className="lg:col-span-2">
             <StudentIntelligence 
               students={scopedStudents} 
               unreadStudentIds={unreadStudentIds} 
               unreadOnlyFilter={unreadOnlyFilter} 
               todayStudentIds={todayStudentIds}
             />
          </div>
          <div className="lg:col-span-1">
             <LapsedStudentsTracker 
               students={scopedStudents} 
               viewScope={viewScope} 
               currentUser={currentUser} 
               refreshTrigger={scheduleRefreshTrigger} 
             />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isCatchupModalOpen && currentUser && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCatchupModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-4xl bg-[#0a0f1c] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Catch-Up Requests</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Confirm or decline pending reschedules</p>
                  </div>
                </div>

                {/* --- NEW: Public URL Copy Box --- */}
                <div className="w-full sm:w-auto flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Your Public Booking Link</span>
                  <div className="flex items-center gap-2">
                    <div className="bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono select-all truncate max-w-[200px] md:max-w-[250px]">
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/catchup/${currentUser.display_name?.split(' ')[0].toLowerCase()}`}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/catchup/${currentUser.display_name?.split(' ')[0].toLowerCase()}`);
                        showToast("Booking link copied to clipboard!", "success");
                      }}
                      className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all"
                      title="Copy Link"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                {/* -------------------------------- */}

                <button type="button" onClick={() => setIsCatchupModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-[#020617]">
                 <TeacherCatchupQueue teacherId={currentUser.id} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MetricDrilldownModal 
        metric={metricDrilldown} 
        pendingSubmissions={pendingSubmissions} 
        onAwardXP={handleAwardXP} 
        students={scopedStudents} 
        todayStudentIds={todayStudentIds}
        onClose={() => setMetricDrilldown(null)} 
        onEnroll={enrollInBootcamp} 
      />
      
      <BulkScheduleManager 
        isOpen={isBulkScheduleOpen} 
        onClose={() => setIsBulkScheduleOpen(false)} 
        students={scopedStudents} 
        activeCourses={activeCourses} 
        currentUser={currentUser}
        onSuccess={() => {
          fetchDashboardData(true);
          setScheduleRefreshTrigger(prev => prev + 1);
        }} 
        showToast={showToast} 
      />

      <AddSingleLessonModal 
        isOpen={!!addingLessonDate} 
        selectedDate={addingLessonDate} 
        onClose={() => setAddingLessonDate(null)} 
        students={scopedStudents} 
        activeCourses={activeCourses} 
        currentUser={currentUser}
        onSuccess={() => {
          fetchDashboardData(true);
          setScheduleRefreshTrigger(prev => prev + 1);
        }} 
        showToast={showToast} 
      />

      <EditLessonModal isOpen={!!editingLessonGroup} lessonGroup={editingLessonGroup} students={scopedStudents} onClose={() => setEditingLessonGroup(null)} onSave={handleSaveLessonEdits} showToast={showToast} />
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function HeroMetrics({ metrics, onDrilldown, scopeName }: { metrics: any, onDrilldown: (metric: string) => void, scopeName: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      <div onClick={() => onDrilldown('reviews')} className="bg-gradient-to-br from-amber-500/10 to-[#020617] border border-amber-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-amber-500/50 hover:scale-[1.02] transition-all group">
        <FileText className="absolute -right-4 -bottom-4 text-amber-500/10 group-hover:text-amber-500/20 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Pending Reviews</p>
        <p className="text-4xl font-black text-white tracking-tighter">{metrics.pendingReviews}</p>
      </div>
      <div onClick={() => onDrilldown('all')} className="bg-gradient-to-br from-purple-500/10 to-[#020617] border border-purple-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-purple-500/50 hover:scale-[1.02] transition-all group">
        <Users className="absolute -right-4 -bottom-4 text-purple-500/10 group-hover:text-purple-500/20 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">{scopeName} Roster</p>
        <p className="text-4xl font-black text-white tracking-tighter">{metrics.totalStudents}</p>
      </div>
      <div onClick={() => onDrilldown('streaks')} className="bg-white/[0.02] border border-white/10 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:scale-[1.02] transition-all group">
        <Activity className="absolute -right-4 -bottom-4 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-400 transition-colors mb-1">Active Streaks</p>
        <p className="text-4xl font-black text-emerald-400 tracking-tighter">{metrics.activeStreaks}</p>
      </div>
      <div onClick={() => onDrilldown('classes')} className="bg-white/[0.02] border border-white/10 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 hover:scale-[1.02] transition-all group">
        <Laptop className="absolute -right-4 -bottom-4 text-blue-500/5 group-hover:text-blue-500/10 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-400 transition-colors mb-1">Classes Today</p>
        <p className="text-4xl font-black text-blue-400 tracking-tighter">{metrics.upcomingClasses}</p>
      </div>
    </div>
  );
}

function ReviewCard({ sub, onAwardXP, isHistoryView = false }: { sub: any, onAwardXP: any, isHistoryView?: boolean }) {
  const maxPossible = sub.potential_xp || 100;
  const maxBonus = Math.floor(maxPossible * 0.1);
  
  const [localTotalEarned, setLocalTotalEarned] = useState(sub.xp_earned || 0);
  
  const existingBonus = sub.source_table === 'tutorial_submissions' 
    ? (sub.bonus_xp || 0) 
    : (sub.teacher_xp_awarded || sub.metadata?.bonus_awarded || 0);
    
  const [localBonusEarned, setLocalBonusEarned] = useState(existingBonus);

  const baseEarned = localTotalEarned - localBonusEarned;
  const remainingBase = Math.max(0, maxPossible - baseEarned);

  const [baseXp, setBaseXp] = useState<number | string>(remainingBase);
  const [bonusXp, setBonusXp] = useState<number | string>(0);
  const [note, setNote] = useState(sub.metadata?.teacher_notes || "");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isEvaluated, setIsEvaluated] = useState(isHistoryView);
  const [justFinished, setJustFinished] = useState(false);

  const handleBaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') { setBaseXp(''); return; }
    let num = parseInt(e.target.value);
    if (num > remainingBase) num = remainingBase;
    if (num < 0) num = 0;
    setBaseXp(num);
  };

  const handleBonusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') { setBonusXp(''); return; }
    let num = parseInt(e.target.value);
    if (num > maxBonus) num = maxBonus;
    if (num < 0) num = 0;
    setBonusXp(num);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    const finalBase = typeof baseXp === 'number' ? baseXp : 0;
    const finalBonus = typeof bonusXp === 'number' ? bonusXp : 0;
    
    await onAwardXP(sub, finalBase, finalBonus, note);
    
    setLocalTotalEarned((prev: number) => prev + finalBase + finalBonus);
    setLocalBonusEarned((prev: number) => prev + finalBonus);
    setBaseXp(0);
    setBonusXp(0);
    setIsEvaluated(true);
    setJustFinished(true); 
    setIsSaving(false);
  };

  const pendingAdd = (typeof baseXp === 'number' ? baseXp : 0) + (typeof bonusXp === 'number' ? bonusXp : 0);

  const isZeroAction = (baseXp === 0 || baseXp === '') && (bonusXp === 0 || bonusXp === '') && note.trim() === '';
  const isButtonDisabled = isSaving || (isHistoryView && isZeroAction);

  if (justFinished) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-pulse min-h-[200px]">
        <CheckCircle2 size={40} className="text-emerald-400" />
        <p className="text-sm font-black uppercase tracking-widest text-emerald-400">Evaluation Saved</p>
        <p className="text-xs text-slate-400">Moved to Evaluated Tab</p>
      </div>
    );
  }

  return (
    <div className={`bg-[#020617] border ${isEvaluated ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 hover:border-amber-500/30'} rounded-3xl p-6 flex flex-col md:flex-row items-center gap-8 transition-all shadow-inner relative overflow-hidden`}>
      
      {isEvaluated && <div className="absolute top-0 right-0 border-b border-l border-emerald-500/30 bg-emerald-500/20 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest text-emerald-400 z-10 flex items-center gap-1"><CheckCircle2 size={10}/> Evaluated</div>}

      <div className="flex-1 w-full space-y-3 relative z-10">
         <h3 className="text-xl font-black text-white uppercase">{sub.profiles?.display_name}</h3>
         <p className="text-sm font-bold text-slate-300">{sub.title || sub.project_title || "Custom Logic Build"}</p>
         
         <div className={`inline-flex items-center gap-3 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 mt-1 transition-colors ${isEvaluated ? 'bg-emerald-500/10 border-emerald-500/20' : ''}`}>
           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
             Max Possible: <span className="text-white">{maxPossible} XP</span>
           </p>
           <span className="text-blue-500/30">|</span>
           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
             Total Earned: <span className={`text-white transition-all ${isEvaluated ? 'text-emerald-400' : ''}`}>{localTotalEarned} XP</span>
             {pendingAdd > 0 && !isEvaluated && (
               <span className="text-amber-400 ml-1">(+{pendingAdd} Pending)</span>
             )}
           </p>
         </div>
         
         <div className="pt-3">
           {sub.media_url ? (
             <a href={sub.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20">
               <ExternalLink size={14}/> View Blueprint / Code
             </a>
           ) : sub.metadata?.submission_urls ? (
             Object.values(sub.metadata.submission_urls).map((url: any, idx) => (
               <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 mr-2 mt-2">
                 <ExternalLink size={14}/> View Submission {idx + 1}
               </a>
             ))
           ) : null}
         </div>
      </div>

      <div className="w-full md:w-1/2 lg:w-5/12 shrink-0 bg-[#0f172a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-5 min-w-[340px] shadow-lg relative z-10">
         
         {isEvaluated ? (
           <div className="flex flex-col gap-3 py-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Final Grade Recorded</span>
                <CheckCircle2 className="text-emerald-500" size={18} />
              </div>
              {note && (
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1"><FileText size={10}/> Teacher Note</p>
                  <p className="text-xs text-slate-300 italic">"{note}"</p>
                </div>
              )}
           </div>
         ) : (
           <>
             <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2 pl-1">Add Base (Max {remainingBase})</label>
                  <input 
                    type="number" 
                    min="0"
                    max={remainingBase}
                    value={baseXp}
                    onChange={handleBaseChange}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500 transition-colors" 
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-amber-500 block mb-2 pl-1">Bonus (Max {maxBonus})</label>
                  <input 
                    type="number" 
                    min="0"
                    max={maxBonus}
                    value={bonusXp}
                    onChange={handleBonusChange}
                    className="w-full bg-[#020617] border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-bold text-amber-400 outline-none focus:border-amber-500 placeholder:text-amber-500/30 transition-colors" 
                  />
                </div>
             </div>
             
             <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2 pl-1 flex items-center gap-1"><FileText size={10}/> Teacher Note</label>
                <input 
                  type="text" 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Great use of loops..." 
                  className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" 
                />
             </div>

             <button 
                onClick={handleSubmit}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-1 border ${
                  isButtonDisabled
                    ? 'bg-amber-600 opacity-50 cursor-not-allowed border-amber-600' 
                    : 'bg-white/5 hover:bg-amber-500 text-slate-300 hover:text-black border-white/10 hover:border-amber-500'
                }`}
             >
               {isSaving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
               {isSaving 
                 ? "Saving..." 
                 : isHistoryView 
                   ? "Add Extra XP/Note" 
                   : isZeroAction 
                     ? "Mark Evaluated" 
                     : "Submit Evaluation"
               }
             </button>
           </>
         )}
      </div>
    </div>
  );
}

function MetricDrilldownModal({ metric, pendingSubmissions, onAwardXP, students, todayStudentIds, onClose, onEnroll }: { metric: string | null, pendingSubmissions?: any[], onAwardXP?: any, students: any[], todayStudentIds?: Set<string>, onClose: () => void, onEnroll: (id: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cachedMetric, setCachedMetric] = useState<string | null>(null);
  const [reviewTab, setReviewTab] = useState<'pending' | 'evaluated'>('pending');

  useEffect(() => {
    if (metric) setCachedMetric(metric);
  }, [metric]);

  const displayMetric = metric || cachedMetric;

  if (displayMetric === 'reviews') {
    const queue = (pendingSubmissions || []).filter(sub => sub.review_status === 'pending');
    const history = (pendingSubmissions || []).filter(sub => sub.review_status === 'reviewed');
    const displayData = reviewTab === 'pending' ? queue : history;

    return (
      <AnimatePresence>
        {metric && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.02] shrink-0 gap-6">
                
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30"><Trophy size={24} /></div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Review Queue</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{queue.length} Submissions Awaiting Feedback</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="flex bg-[#020617] rounded-xl p-1 border border-white/5 shadow-inner flex-1 sm:flex-none">
                    <button
                      onClick={() => setReviewTab('pending')}
                      className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${reviewTab === 'pending' ? 'bg-amber-500/20 text-amber-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                      Pending <span className="bg-amber-500/20 px-2 py-0.5 rounded-full">{queue.length}</span>
                    </button>
                    <button
                      onClick={() => setReviewTab('evaluated')}
                      className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${reviewTab === 'evaluated' ? 'bg-emerald-500/20 text-emerald-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                      Evaluated <CheckCircle2 size={12} />
                    </button>
                  </div>
                  
                  <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full shrink-0"><X size={20} /></button>
                </div>

              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {displayData.length === 0 ? (
                   <div className="text-center p-16 border border-dashed border-white/5 rounded-3xl">
                     <p className="text-slate-500 italic font-bold">No submissions found in this tab.</p>
                   </div>
                ) : (
                  displayData.map((sub) => (
                    <ReviewCard key={sub.id} sub={sub} onAwardXP={onAwardXP} isHistoryView={reviewTab === 'evaluated'} />
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // --- STUDENT LIST VIEWS ---
  let title = "Student List";
  let filtered = students;
  let icon = <Users size={24} />;

  if (displayMetric === 'streaks') {
    title = "Active Streaks";
    filtered = students.filter(s => s.attendance.includes('Streak'));
    icon = <Activity size={24} className="text-emerald-400"/>;
  } else if (displayMetric === 'classes') {
    title = "Scheduled Today";
    filtered = students.filter(s => todayStudentIds?.has(s.id));
    icon = <Laptop size={24} className="text-blue-400"/>;
  } else if (displayMetric === 'alerts') {
    title = "Medical & Alerts";
    filtered = students.filter(s => s.alerts.length > 0);
    icon = <AlertTriangle size={24} className="text-rose-400"/>;
  } else if (displayMetric === 'all') {
    title = "Active Roster";
    icon = <Users size={24} className="text-purple-400"/>;
  }

  const basePath = pathname.includes('/admin') ? '/admin/student' : '/teacher/student';

  return (
    <AnimatePresence>
      {metric && displayMetric !== 'reviews' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">{icon}</div>
                <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{title}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{filtered.length} Students Matching</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto no-scrollbar flex-1">
              {filtered.length > 0 ? (
                <div className="bg-[#020617] rounded-3xl border border-white/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Current Course</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map((s: any) => (
                        <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 font-bold text-sm text-white group-hover:text-purple-400 transition-colors flex items-center gap-2">
                             {s.name}
                             {s.alerts.length > 0 && <AlertTriangle size={12} className="text-rose-500" />}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">{s.course}</td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                             <button 
                               onClick={() => { onClose(); router.push(`${basePath}/${s.id}`); }}
                               className="px-3 py-1.5 bg-white/5 text-slate-400 border border-white/10 rounded-lg text-[9px] font-black uppercase hover:text-white"
                             >
                               View Profile
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<p className="text-center text-slate-500 italic p-8">No students found matching this metric.</p>)}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function StudentIntelligence({ students, unreadStudentIds, unreadOnlyFilter, todayStudentIds }: { students: any[], unreadStudentIds: Set<string>, unreadOnlyFilter: boolean, todayStudentIds?: Set<string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("All Courses");
  const [scheduledTodayFilter, setScheduledTodayFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const availableFilters = useMemo(() => {
    const courses = new Set<string>();
    students.forEach(s => {
      if (s.coursesList) s.coursesList.forEach((c: string) => courses.add(c));
    });
    return ["All Courses", ...Array.from(courses)];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (unreadOnlyFilter && !unreadStudentIds.has(s.id)) return false;

      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = courseFilter === "All Courses" || s.coursesList?.includes(courseFilter);
      
      const isScheduledToday = todayStudentIds ? todayStudentIds.has(s.id) : false;
      const matchesSchedule = !scheduledTodayFilter || isScheduledToday;
      s._isScheduledToday = isScheduledToday;

      return matchesSearch && matchesCourse && matchesSchedule;
    });
  }, [students, searchQuery, courseFilter, scheduledTodayFilter, unreadOnlyFilter, unreadStudentIds, todayStudentIds]);

  useMemo(() => { setCurrentPage(1); }, [searchQuery, courseFilter, scheduledTodayFilter, unreadOnlyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, filteredStudents.length);

  const basePath = pathname.includes('/admin') ? '/admin/student' : '/teacher/student';

  return (
    <div className="space-y-6 flex flex-col h-[700px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2">
          <Users className="text-purple-500"/> Student Intelligence
        </h2>
        <div className="relative w-full sm:w-72 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search student name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-purple-500 shadow-inner transition-all placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-[24px] shrink-0">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Filters:</span>
        </div>
        <select 
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="bg-[#020617] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:border-purple-500 outline-none appearance-none cursor-pointer"
        >
          {availableFilters.map(course => <option key={course} value={course as string}>{course}</option>)}
        </select>
        <button 
          onClick={() => setScheduledTodayFilter(!scheduledTodayFilter)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
            scheduledTodayFilter 
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
            : 'bg-[#020617] text-slate-400 border-white/10 hover:border-white/20'
          }`}
        >
          <CalendarCheck size={14} /> Scheduled Today
        </button>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl flex flex-col flex-1">
        <div className="divide-y divide-white/5 flex-1 overflow-y-auto custom-scrollbar">
          {paginatedStudents.map((student) => {
            const hasUnread = unreadStudentIds.has(student.id);

            return (
              <div 
                key={student.id} 
                onClick={() => router.push(`${basePath}/${student.id}`)}
                className={`p-6 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${
                  hasUnread 
                    ? 'bg-purple-500/5 border-l-4 border-l-purple-500 hover:bg-purple-500/10' 
                    : 'border-l-4 border-transparent hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg font-black text-white shadow-inner shrink-0 ${
                    hasUnread ? 'bg-purple-600 border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-white/10'
                  }`}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-lg font-black transition-colors leading-none truncate max-w-full ${hasUnread ? 'text-purple-300' : 'text-white group-hover:text-purple-400'}`}>
                        {student.name}
                      </h3>
                      
                      {hasUnread && (
                        <span className="flex items-center gap-1 bg-purple-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse shrink-0">
                          <Bell size={10} /> New Message
                        </span>
                      )}

                      {student.alerts.length > 0 && <AlertTriangle size={14} className="text-rose-500 animate-pulse shrink-0"/>}
                      
                      {student.delivery_method?.toLowerCase() === "online" && (
                        <span title="Online Lesson" className="shrink-0">
                           <Video size={12} className="text-blue-400" />
                        </span>
                      )}
                      
                      {student._isScheduledToday && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">Today</span>}
                    </div>
                    <p className="text-xs font-bold text-slate-500 mt-1.5 line-clamp-2 pr-4" title={student.course}>{student.course}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-8 sm:gap-12 mt-2 sm:mt-0 shrink-0">
                  <div className="hidden xl:block">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Skill Level</p>
                    <p className="text-sm font-bold text-purple-400 flex items-center gap-1 mt-0.5"><Target size={12}/> {student.skillLevel}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Attendance / Streak</p>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">{student.attendance}</p>
                  </div>
                  <ChevronRight className={`${hasUnread ? 'text-purple-400' : 'text-slate-600 group-hover:text-white'} transition-colors shrink-0`} />
                </div>
              </div>
            )
          })}
          {filteredStudents.length === 0 && (
            <div className="p-12 text-center text-slate-500 italic text-sm font-bold">
              {unreadOnlyFilter ? "No unread messages found." : "No students found matching your filters."}
            </div>
          )}
        </div>

        {filteredStudents.length > 0 && (
          <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Showing {startIdx} - {endIdx} of {filteredStudents.length} Students
            </p>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-white/10"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-slate-400 px-4">Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-white/10"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditLessonModal({ isOpen, onClose, lessonGroup, students, onSave, showToast }: any) {
  const [activeTab, setActiveTab] = useState<'details' | 'wrapup'>('details');
  
  const [dateStr, setDateStr] = useState("");
  const [delivery, setDelivery] = useState("in-person");
  const [logistics, setLogistics] = useState("");
  const [attendees, setAttendees] = useState<any[]>([]);
  
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [sessionXp, setSessionXp] = useState<number>(50);
  const [sessionNote, setSessionNote] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && lessonGroup) {
      const d = lessonGroup.dateObj;
      const tzOffset = d.getTimezoneOffset() * 60000; 
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0,16);
      
      setDateStr(localISOTime);
      setDelivery(lessonGroup.delivery || "in-person");
      setLogistics(lessonGroup.link || lessonGroup.location || "");
      setAttendees(lessonGroup.attendees || []);
      
      setActiveTab('details');
      setAttendance({});
      setSessionXp(50);
      setSessionNote("");
    }
  }, [isOpen, lessonGroup]);

  if (!isOpen || !lessonGroup) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const newDateISO = new Date(dateStr).toISOString();
    
    const wrapUpData = {
      attendance,
      xp: sessionXp,
      note: sessionNote
    };

    await onSave(lessonGroup, attendees, newDateISO, delivery, logistics, wrapUpData);
    setIsSaving(false);
    onClose();
  };

  const handleAddStudent = (studentId: string) => {
    if (!studentId) return;
    const student = students.find((s: any) => s.id === studentId);
    if (student && !attendees.find(a => a.studentId === student.id)) {
       setAttendees((prev: any[]) => [...prev, { studentId: student.id, studentName: student.name }]);
    }
  };

  const setStudentStatus = (studentId: string, status: string) => {
    setAttendance((prev: Record<string, string>) => ({ ...prev, [studentId]: status }));
  };

  const availableToAdd = students.filter((s: any) => !attendees.find(a => a.studentId === s.id));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30"><LayoutDashboard size={20} /></div>
            <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Session Manager</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 line-clamp-1">{lessonGroup.topic}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex p-2 bg-[#020617] border-b border-white/5 shrink-0 gap-2">
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'details' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <CalendarRange size={14}/> Logistics
          </button>
          <button 
            onClick={() => setActiveTab('wrapup')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'wrapup' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <CheckCircle2 size={14}/> Log Attendance
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'details' ? (
              <motion.div key="details" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={dateStr} 
                    onChange={e => setDateStr(e.target.value)} 
                    className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 cursor-pointer" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                      <div className="relative">
                          <select 
                            value={delivery} 
                            onChange={e => {
                                setDelivery(e.target.value);
                                setLogistics(""); 
                            }} 
                            className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none"
                          >
                            <option value="in-person">In-Person</option>
                            <option value="online">Online</option>
                          </select>
                          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Venue / Link</label>
                      <input 
                        type={delivery === 'online' ? 'url' : 'text'}
                        value={logistics} 
                        onChange={e => setLogistics(e.target.value)} 
                        placeholder={delivery === 'online' ? "https://zoom.us/..." : "e.g. Centurion Main Lab"}
                        className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500" 
                      />
                   </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Manage Attendees</label>
                    <span className="text-[9px] font-black bg-white/5 px-2 py-1 rounded text-slate-400">{attendees.length} Students</span>
                  </div>
                  
                  <div className="bg-[#020617] border border-white/5 rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {attendees.length === 0 ? (
                      <div className="p-4 text-center text-xs text-rose-400 italic font-bold">This session will be completely deleted.</div>
                    ) : (
                      attendees.map((a: any) => (
                        <div key={a.studentId} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl transition-colors group">
                          <span className="text-sm font-bold text-white">{a.studentName}</span>
                          <button 
                            onClick={() => setAttendees((prev: any[]) => prev.filter(att => att.studentId !== a.studentId))}
                            className="text-xs font-bold text-rose-500/50 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                          >
                            <X size={14}/> Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {delivery === 'in-person' && availableToAdd.length > 0 && (
                     <div className="bg-[#0f172a] border border-blue-500/20 rounded-2xl p-4">
                       <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1"><UserPlus size={10}/> Add Student to Group</label>
                       <select 
                          value="" 
                          onChange={e => handleAddStudent(e.target.value)} 
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 appearance-none"
                       >
                          <option value="" disabled>Select a student to add...</option>
                          {availableToAdd.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                     </div>
                  )}
                  {attendees.length < lessonGroup.attendees?.length && (
                    <p className="text-[9px] text-rose-400 italic px-2 font-bold mt-2">Removing a student completely un-enrolls them from this specific timeslot.</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="wrapup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="p-6 space-y-8">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> Roster Roll-Call</label>
                  </div>
                  
                  <div className="space-y-3">
                    {attendees.length === 0 ? (
                      <p className="text-center text-slate-500 italic text-xs p-4">No students to mark.</p>
                    ) : (
                      attendees.map((a: any) => {
                        const currentStatus = attendance[a.studentId];
                        return (
                          <div key={a.studentId} className="bg-[#020617] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
                            <span className="text-sm font-black text-white">{a.studentName}</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <button 
                                onClick={() => setStudentStatus(a.studentId, 'present')}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex justify-center items-center gap-1 ${currentStatus === 'present' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'}`}
                              >
                                {currentStatus === 'present' && <Check size={10}/>} Present
                              </button>
                              <button 
                                onClick={() => setStudentStatus(a.studentId, 'absent')}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex justify-center items-center gap-1 ${currentStatus === 'absent' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'}`}
                              >
                                {currentStatus === 'absent' && <XCircle size={10}/>} Absent
                              </button>
                              <button 
                                onClick={() => setStudentStatus(a.studentId, 'late')}
                                title="Arrived 10+ minutes after start time"
                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex justify-center items-center gap-1 ${currentStatus === 'late' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'}`}
                              >
                                {currentStatus === 'late' && <Clock size={10}/>} Late
                              </button>
                              <button 
                                onClick={() => setStudentStatus(a.studentId, 'rescheduled')}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex justify-center items-center gap-1 ${currentStatus === 'rescheduled' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'}`}
                              >
                                {currentStatus === 'rescheduled' && <Repeat size={10}/>} Resched
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 ml-2 flex items-center gap-1"><Trophy size={10}/> Award Session XP</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={sessionXp} 
                        onChange={e => setSessionXp(Number(e.target.value))} 
                        className="w-full bg-[#020617] border border-purple-500/30 rounded-2xl px-4 py-3 pl-12 text-sm font-bold text-white outline-none focus:border-purple-500" 
                      />
                      <Zap size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                    </div>
                    <p className="text-[8px] text-slate-500 italic ml-2">Awarded to Present/Late students.</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-1"><FileText size={10}/> Admin / Class Notes</label>
                    <textarea 
                      value={sessionNote}
                      onChange={e => setSessionNote(e.target.value)}
                      placeholder="e.g. John struggled with loops today, but Sarah nailed it."
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-purple-500 custom-scrollbar min-h-[80px]"
                    />
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex flex-wrap justify-between items-center gap-4 shrink-0">
          <button 
            onClick={async () => {
              if(!window.confirm("Are you sure you want to completely delete this session for ALL attendees?")) return;
              setIsSaving(true);
              await onSave(lessonGroup, [], new Date(dateStr).toISOString(), delivery, logistics, { attendance: {}, xp: 0, note: '' });
              setIsSaving(false);
              onClose();
            }} 
            className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} /> Delete
          </button>
          
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button onClick={onClose} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !dateStr}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Update
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}