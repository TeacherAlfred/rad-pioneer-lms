"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, Calendar, Activity, AlertTriangle, Search, Filter, 
  ChevronRight, Phone, Mail, Target, BookOpen, 
  MessageSquare, Shield, Clock, Plus, Zap, Laptop,
  CheckCircle2, ChevronLeft, CalendarCheck, Loader2, X, Edit2, Save, MapPin, Video, CalendarPlus,
  CalendarDays, Repeat, CheckSquare, Square, UserPlus, Globe, User, LogOut, Trash2, ChevronDown, LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

const AVAILABLE_COURSES = [
  "Robotics Pioneer Bootcamp", 
  "Intro to Python", 
  "Advanced Web Dev", 
  "AI & Machine Learning",
  "Term 2 Lessons (Online)",
  "Unassigned"
];

// DYNAMIC SYLLABUS MAP
const COURSE_SYLLABUS: Record<string, { week: number, title: string }[]> = {
  "Robotics Pioneer Bootcamp": [
    { week: 1, title: "Intro to Microcontrollers & Safety" },
    { week: 2, title: "Sensors, Inputs, and Logic Gates" },
    { week: 3, title: "Actuators & Motor Control" },
    { week: 4, title: "Autonomous Navigation Algorithms" },
    { week: 5, title: "Final Project: Line-Following Bot" }
  ],
  "Intro to Python": [
    { week: 1, title: "Syntax, Variables & Data Types" },
    { week: 2, title: "Control Flow (If/Else & Loops)" },
    { week: 3, title: "Functions & Scope" },
    { week: 4, title: "Lists, Dictionaries & JSON" },
    { week: 5, title: "Final Project: Terminal Game" }
  ]
};

const getSyllabusForCourse = (courseName: string) => {
  if (COURSE_SYLLABUS[courseName]) return COURSE_SYLLABUS[courseName];
  return Array.from({ length: 8 }).map((_, i) => ({ week: i + 1, title: `Standard Module ${i + 1}` }));
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function TeacherDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [metricDrilldown, setMetricDrilldown] = useState<string | null>(null);
  const [isBulkScheduleOpen, setIsBulkScheduleOpen] = useState(false);
  const [editingLessonGroup, setEditingLessonGroup] = useState<any | null>(null);
  
  const [students, setStudents] = useState<any[]>([]);
  const [activeCourses, setActiveCourses] = useState<any[]>([]);
  const [educators, setEducators] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // ViewScope handles: 'global', 'my_roster', or a specific 'teacher_uuid'
  const [viewScope, setViewScope] = useState<string>('global');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Set the default view based on user role once loaded
  useEffect(() => {
    if (currentUser) {
      setViewScope(currentUser.role === 'admin' ? 'global' : 'my_roster');
    }
  }, [currentUser]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      if (profile) setCurrentUser(profile);

      // Fetch all required data in parallel
      const [studentsRes, guardiansRes, coursesRes, enrollmentsRes, educatorsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('display_name', { ascending: true }),
        supabase.from('profiles').select('id, display_name, metadata').in('role', ['guardian', 'admin']),
        supabase.from('courses').select('*').eq('is_published', true).order('order_index', { ascending: true }),
        supabase.from('enrollments').select('*, courses(*)'),
        supabase.from('profiles').select('id, display_name').eq('role', 'educator').order('display_name', { ascending: true })
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (guardiansRes.error) throw guardiansRes.error;
      
      if (coursesRes.data) setActiveCourses(coursesRes.data);
      if (educatorsRes.data) setEducators(educatorsRes.data);

      const enrollmentsMap = new Map();
      if (enrollmentsRes.data) {
         enrollmentsRes.data.forEach((enr: any) => {
             if (enr.status === 'active' || !enrollmentsMap.has(enr.student_id)) {
                 const c = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
                 if (c && c.title) {
                     enrollmentsMap.set(enr.student_id, c.title);
                 }
             }
         });
      }

      const guardiansMap = new Map(guardiansRes.data.map(g => [g.id, g]));

      const mappedStudents = studentsRes.data.map(s => {
        const guardian: any = guardiansMap.get(s.linked_parent_id) || {};
        const guardianMeta: any = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
        const studentMeta: any = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {});
        
        let age: string | number = "N/A";
        if (s.date_of_birth) {
          const diffMs = Date.now() - new Date(s.date_of_birth).getTime();
          const ageDt = new Date(diffMs); 
          age = Math.abs(ageDt.getUTCFullYear() - 1970);
        }

        const course = enrollmentsMap.get(s.id) || "Unassigned";

        return {
          id: s.id,
          student_identifier: s.student_identifier,
          name: s.display_name || "Unknown Pioneer",
          age: age,
          course: course,
          delivery_method: studentMeta.learning_mode || "In-person",
          schedule: studentMeta.schedule || [], 
          attendance: s.current_streak > 0 ? `${s.current_streak} Day Streak` : "No Recent Logins",
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
      });

      setStudents(mappedStudents);

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem("pioneer_session");
    await supabase.auth.signOut();
    router.push("/login");
  };

  // --- DYNAMIC SCOPE FILTERING ---
  const scopedStudents = useMemo(() => {
    if (viewScope === 'global') return students;
    if (viewScope === 'my_roster') return students.filter(s => s.teacherId === currentUser?.id);
    
    // Otherwise, viewScope is an exact teacher ID (Admin View)
    return students.filter(s => s.teacherId === viewScope);
  }, [students, viewScope, currentUser]);

  // Derived name for the Hero Metrics
  let scopeName = "Global";
  if (viewScope === 'my_roster') scopeName = "My";
  else if (viewScope !== 'global') {
    const edName = educators.find(e => e.id === viewScope)?.display_name?.split(' ')[0];
    scopeName = edName ? `${edName}'s` : "Teacher";
  }

  const handleSaveLessonEdits = async (lessonGroup: any, finalAttendees: any[], newDateISO: string, newDelivery: string, newLogistics: string) => {
    try {
      const originalAttendees = lessonGroup.attendees || [];
      const originalIds = originalAttendees.map((a: any) => a.studentId);
      const finalIds = finalAttendees.map((a: any) => a.studentId);

      const removedIds = originalIds.filter((id: string) => !finalIds.includes(id));
      const keptIds = originalIds.filter((id: string) => finalIds.includes(id));
      const addedIds = finalIds.filter((id: string) => !originalIds.includes(id));

      const isLink = newDelivery === 'online';

      const updateStudentScheduleOnly = async (studentId: string, mutator: (sched: any[]) => any[]) => {
         const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', studentId).single();
         if(profile) {
             const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
             meta.schedule = mutator(meta.schedule || []);
             await supabase.from('profiles').update({ metadata: meta }).eq('id', studentId);
         }
      };

      await Promise.all([
        ...removedIds.map((id: string) => {
          const origAtt = originalAttendees.find((a: any) => a.studentId === id);
          return updateStudentScheduleOnly(id, sched => sched.filter(l => l.id !== origAtt?.lessonId));
        }),
        ...keptIds.map((id: string) => {
          const origAtt = originalAttendees.find((a: any) => a.studentId === id);
          return updateStudentScheduleOnly(id, sched => sched.map(l => (l.id === origAtt?.lessonId ? { 
              ...l, 
              date: newDateISO,
              delivery: newDelivery,
              link: isLink ? newLogistics : null,
              location: !isLink ? newLogistics : null
          } : l)));
        }),
        ...addedIds.map((id: string) => {
          const newLesson = {
            id: Math.random().toString(36).substring(7),
            date: newDateISO,
            topic: lessonGroup.topic,
            course: lessonGroup.course,
            delivery: newDelivery,
            link: isLink ? newLogistics : null,
            location: !isLink ? newLogistics : null,
            reminders: { parents: true, teacher: true }
          };
          return updateStudentScheduleOnly(id, sched => [...sched, newLesson]);
        })
      ]);

      await fetchDashboardData();
    } catch (err) {
      console.error("Failed to update lesson edits:", err);
      alert("Failed to update lesson.");
    }
  };

  const handleBulkSchedule = async (params: { studentIds: string[], course: string, delivery: string, startDate: string, startTopic: string, weeks: number, reminders: any }) => {
    const dbCourse = activeCourses.find(c => c.title === params.course);
    const customSyllabus = dbCourse?.syllabus || dbCourse?.metadata?.syllabus;
    const syllabus = (customSyllabus && Array.isArray(customSyllabus) && customSyllabus.length > 0) 
      ? customSyllabus 
      : Array.from({ length: 8 }).map((_, i) => ({ week: i + 1, title: `Standard Module ${i + 1}` }));

    const startIdx = Math.max(0, syllabus.findIndex((l: any) => `Week ${l.week}: ${l.title}` === params.startTopic));
    const startDt = new Date(params.startDate);

    const lessonsToCreate: any[] = [];

    for (let i = 0; i < params.weeks; i++) {
      const lessonDate = new Date(startDt);
      lessonDate.setDate(lessonDate.getDate() + (i * 7)); 

      const topicObj = syllabus[startIdx + i];
      const topicStr = topicObj ? `Week ${topicObj.week}: ${topicObj.title}` : "TBD / Open Session";

      lessonsToCreate.push({
        id: Math.random().toString(36).substring(7),
        date: lessonDate.toISOString(),
        topic: topicStr,
        course: params.course,
        delivery: params.delivery,
        reminders: params.reminders
      });
    }

    await Promise.all(params.studentIds.map(async (id) => {
      const student = students.find(s => s.id === id);
      if(!student) return;

      const currentSchedule = student.schedule || [];
      
      const filteredLessonsToCreate = lessonsToCreate.filter(newLesson => {
         const newLessonDateString = new Date(newLesson.date).toLocaleDateString();
         const isDuplicate = currentSchedule.some((existingLesson: any) => {
            const existingLessonDateString = new Date(existingLesson.date).toLocaleDateString();
            return existingLessonDateString === newLessonDateString && existingLesson.topic === newLesson.topic;
         });
         return !isDuplicate;
      });

      if (filteredLessonsToCreate.length === 0) return;

      const newSchedule = [...currentSchedule, ...filteredLessonsToCreate];

      const { data: profile, error: fetchErr } = await supabase.from('profiles').select('metadata').eq('id', id).single();
      if (!fetchErr) {
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        meta.schedule = newSchedule;
        meta.learning_mode = params.delivery; 
        if (!meta.interested_programs || meta.interested_programs[0] !== params.course) {
          meta.interested_programs = [params.course];
        }
        await supabase.from('profiles').update({ metadata: meta }).eq('id', id);
      }
    }));

    await fetchDashboardData();
  };

  const todayClassesCount = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    
    const uniqueClasses = new Set<string>();
    scopedStudents.forEach(s => {
      if (s.schedule) {
        s.schedule.forEach((lesson: any) => {
          const t = new Date(lesson.date).getTime();
          const delivery = lesson.delivery || s.delivery_method || 'In-person';
          const topic = lesson.topic || s.course;
          if (t >= todayStart && t < todayEnd) {
            uniqueClasses.add(`${t}-${topic}-${delivery}`);
          }
        });
      }
    });
    return uniqueClasses.size;
  }, [scopedStudents]);

  const metrics = {
    totalStudents: scopedStudents.length,
    activeStreaks: scopedStudents.filter(s => s.attendance.includes('Streak')).length,
    upcomingClasses: todayClassesCount, 
    activeAlerts: scopedStudents.filter(s => s.alerts.length > 0).length
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Loading Student Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP ROW: BRANDING & NAVIGATION */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-500">
              <Shield size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Instructional_Command</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
              Educator_<span className="text-purple-500">Portal</span>
            </h1>
            <p className="text-slate-400 font-medium mt-2">Welcome back, {currentUser?.display_name || 'Admin'}. You have {metrics.upcomingClasses} class sessions scheduled today.</p>
          </div>

          <div className="flex flex-wrap items-end sm:items-center gap-3">
            {currentUser?.role === 'admin' && (
              <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-slate-300">
                <LayoutDashboard size={14}/> Admin Hub
              </button>
            )}
            <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />
            <button 
              onClick={handleLogout} 
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all"
              title="Log Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* TOOLBAR ROW: FILTERS & ACTIONS (Role-Based View) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 pb-6">
           
           {/* SCOPE SELECTION (Admin vs Teacher) */}
           {currentUser?.role === 'admin' ? (
             // ADMIN VIEW: Scrollable Educator Pills
             <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
               <button
                 onClick={() => setViewScope('global')}
                 className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === 'global' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}
               >
                 <Globe size={14} /> Global View
               </button>

               {educators.map(ed => (
                 <button
                   key={ed.id}
                   onClick={() => setViewScope(ed.id)}
                   className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === ed.id ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}
                 >
                   <User size={14} /> {ed.display_name.split(' ')[0]}
                 </button>
               ))}
             </div>
           ) : (
             // TEACHER VIEW: Simple Roster Toggle
             <div className="flex bg-[#0f172a] border border-white/10 rounded-2xl p-1 shadow-inner shrink-0">
               <button 
                 onClick={() => setViewScope('my_roster')}
                 className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewScope === 'my_roster' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
               >
                 <User size={14} /> My Roster
               </button>
               <button 
                 onClick={() => setViewScope('global')}
                 className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewScope === 'global' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
               >
                 <Globe size={14} /> Global View
               </button>
             </div>
           )}

           {/* BULK ACTIONS */}
           <button 
             onClick={() => setIsBulkScheduleOpen(true)}
             className="shrink-0 w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg"
           >
             <CalendarDays size={14}/> Bulk Schedule
           </button>
        </div>

        {/* HERO METRICS */}
        <HeroMetrics metrics={metrics} onDrilldown={setMetricDrilldown} scopeName={scopeName} />

        {/* 7-DAY TRACKER */}
        <NextDaysTracker students={scopedStudents} onEditLesson={setEditingLessonGroup} />

        {/* WORKSPACE AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          <div className="lg:col-span-2">
             <StudentIntelligence students={scopedStudents} />
          </div>
          <div className="lg:col-span-1">
             <ItinerarySidebar students={scopedStudents} onEditLesson={setEditingLessonGroup} />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <MetricDrilldownModal metric={metricDrilldown} students={scopedStudents} onClose={() => setMetricDrilldown(null)} />

      <BulkScheduleModal
        isOpen={isBulkScheduleOpen} onClose={() => setIsBulkScheduleOpen(false)}
        students={scopedStudents} activeCourses={activeCourses} onSchedule={handleBulkSchedule}
      />

      <EditLessonModal 
        isOpen={!!editingLessonGroup}
        lessonGroup={editingLessonGroup}
        students={scopedStudents}
        onClose={() => setEditingLessonGroup(null)}
        onSave={handleSaveLessonEdits}
      />

    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function HeroMetrics({ metrics, onDrilldown, scopeName }: { metrics: any, onDrilldown: (metric: string) => void, scopeName: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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
      <div onClick={() => onDrilldown('alerts')} className="bg-gradient-to-br from-rose-500/10 to-[#020617] border border-rose-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-rose-500/50 hover:scale-[1.02] transition-all group">
        <AlertTriangle className="absolute -right-4 -bottom-4 text-rose-500/10 group-hover:text-rose-500/20 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Medical / Alerts</p>
        <p className="text-4xl font-black text-white tracking-tighter">{metrics.activeAlerts}</p>
      </div>
    </div>
  );
}

function MetricDrilldownModal({ metric, students, onClose }: { metric: string | null, students: any[], onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cachedMetric, setCachedMetric] = useState<string | null>(null);

  useEffect(() => {
    if (metric) setCachedMetric(metric);
  }, [metric]);

  const displayMetric = metric || cachedMetric;

  let title = "Student List";
  let filtered = students;
  let icon = <Users size={24} />;

  if (displayMetric === 'streaks') {
    title = "Active Streaks";
    filtered = students.filter(s => s.attendance.includes('Streak'));
    icon = <Activity size={24} className="text-emerald-400"/>;
  } else if (displayMetric === 'classes') {
    title = "Scheduled Today";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    filtered = students.filter(s => {
      return (s.schedule || []).some((lesson: any) => {
        const t = new Date(lesson.date).getTime();
        return t >= todayStart && t < todayEnd;
      });
    });
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
      {metric && displayMetric && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
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
                        <th className="px-6 py-4">Attendance</th>
                        <th className="px-6 py-4 text-right">Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map((s: any) => (
                        <tr key={s.id} onClick={() => { onClose(); router.push(`${basePath}/${s.id}`); }} className="hover:bg-white/5 cursor-pointer transition-colors group">
                          <td className="px-6 py-4 font-bold text-sm text-white group-hover:text-purple-400 transition-colors flex items-center gap-2">{s.name}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">{s.course}</td>
                          <td className="px-6 py-4 text-xs font-bold text-emerald-400">{s.attendance}</td>
                          <td className="px-6 py-4 text-right">
                            {s.alerts.length > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-400 px-2 py-1 rounded-md text-[9px] font-black uppercase"><AlertTriangle size={10}/> {s.alerts.length} Alert</span>
                            ) : (<span className="text-slate-600">-</span>)}
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

function NextDaysTracker({ students, onEditLesson }: { students: any[], onEditLesson: (lessonGroup: any) => void }) {
  const scheduleDays = useMemo(() => {
    const rawLessons = students.flatMap(student =>
      (student.schedule || []).map((lesson: any) => {
         const lessonDate = new Date(lesson.date);
         return {
            lessonId: lesson.id,
            dateObj: lessonDate,
            dateTs: lessonDate.getTime(),
            topic: lesson.topic,
            studentId: student.id,
            studentName: student.name,
            course: lesson.course || student.course,
            delivery: lesson.delivery || student.delivery_method || 'in-person',
            location: lesson.location || '',
            link: lesson.link || null
         };
      })
    );

    const groupedMap = new Map<string, any>();
    rawLessons.forEach(lesson => {
      const key = `${lesson.dateTs}-${lesson.topic}-${lesson.delivery}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { 
          ...lesson, 
          key: key, 
          attendees: [{ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId }] 
        });
      } else {
        groupedMap.get(key).attendees.push({ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId });
      }
    });

    const groupedLessons = Array.from(groupedMap.values());
    groupedLessons.sort((a, b) => a.dateTs - b.dateTs);

    const now = new Date();
    now.setHours(0,0,0,0);

    return Array.from({ length: 7 }).map((_, i) => {
       const d = new Date(now);
       d.setDate(d.getDate() + i);
       const start = d.getTime();
       const end = start + 24 * 60 * 60 * 1000;
       
       let label = d.toLocaleDateString('en-US', { weekday: 'short' });
       if (i === 0) label = 'Today';
       if (i === 1) label = 'Tomorrow';

       return {
          dateObj: d,
          label,
          dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          lessons: groupedLessons.filter(l => l.dateTs >= start && l.dateTs < end)
       };
    });
  }, [students]);

  return (
    <div className="pt-6 pb-2">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={18} className="text-purple-500" />
        <h2 className="text-lg font-black uppercase italic tracking-widest text-white">7-Day Horizon</h2>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {scheduleDays.map((day, idx) => (
          <div key={idx} className="bg-[#0f172a]/80 backdrop-blur-md border border-white/5 rounded-3xl p-4 min-w-[150px] lg:min-w-0 flex-1 flex flex-col snap-start shrink-0 shadow-lg">
             <div className="flex flex-col 2xl:flex-row 2xl:items-baseline justify-between mb-3 border-b border-white/5 pb-2 gap-1">
               <h3 className={`text-sm font-black uppercase tracking-widest ${idx === 0 ? 'text-blue-400' : 'text-slate-300'}`}>{day.label}</h3>
               <span className="text-[9px] font-bold text-slate-500">{day.dateStr}</span>
             </div>
             
             <div className="flex-1 space-y-2">
                {day.lessons.length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-600 italic text-center py-4">No lessons scheduled</p>
                ) : (
                  day.lessons.map((lesson: any, lessonIdx: number) => {
                    const isOnline = lesson.delivery === 'online';
                    const isMissingLogistics = (isOnline && !lesson.link) || (!isOnline && !lesson.location);
                    
                    const displayText = !isOnline 
                      ? lesson.location 
                      : lesson.attendees.map((a:any) => a.studentName).join(', ');

                    return (
                      <div 
                        key={lesson.key || `${lesson.dateTs}-${lessonIdx}`} 
                        onClick={() => onEditLesson(lesson)}
                        className="bg-[#020617] border border-white/5 rounded-2xl p-3 flex flex-col gap-1.5 group hover:border-blue-500/50 transition-colors cursor-pointer relative"
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity">
                          <Edit2 size={12}/>
                        </div>

                        <p className={`text-xs font-black pr-5 ${isOnline ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {new Date(lesson.dateTs).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        
                        <div className="flex items-start gap-1.5">
                          {isOnline ? <Video size={12} className="text-purple-500 shrink-0 mt-0.5"/> : <MapPin size={12} className={`shrink-0 mt-0.5 ${lesson.location ? 'text-emerald-500' : 'text-amber-500'}`}/>}
                          
                          {isMissingLogistics ? (
                             <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                               + Add {isOnline ? 'Link' : 'Venue'}
                             </span>
                          ) : (
                             <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">
                               {displayText}
                             </p>
                          )}
                        </div>

                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 truncate mt-0.5">
                          {lesson.topic}
                        </p>
                      </div>
                    )
                  })
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentIntelligence({ students }: { students: any[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("All Courses");
  const [scheduledTodayFilter, setScheduledTodayFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const availableFilters = useMemo(() => {
    const courses = new Set(students.map(s => s.course));
    return ["All Courses", ...Array.from(courses).filter(Boolean)];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = courseFilter === "All Courses" || s.course === courseFilter;
      
      let isScheduledToday = false;
      if (s.schedule) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000;
        isScheduledToday = s.schedule.some((lesson: any) => {
          const t = new Date(lesson.date).getTime();
          return t >= todayStart && t < todayEnd;
        });
      }

      const matchesSchedule = !scheduledTodayFilter || isScheduledToday;
      s._isScheduledToday = isScheduledToday;

      return matchesSearch && matchesCourse && matchesSchedule;
    });
  }, [students, searchQuery, courseFilter, scheduledTodayFilter]);

  useMemo(() => { setCurrentPage(1); }, [searchQuery, courseFilter, scheduledTodayFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, filteredStudents.length);

  const basePath = pathname.includes('/admin') ? '/admin/student' : '/teacher/student';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

      <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-[24px]">
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

      <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
        <div className="divide-y divide-white/5 flex-1">
          {paginatedStudents.map((student) => (
            <div 
              key={student.id} 
              onClick={() => router.push(`${basePath}/${student.id}`)}
              className="p-6 hover:bg-white/[0.04] transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-lg font-black text-white shadow-inner shrink-0">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors leading-none">{student.name}</h3>
                    {student.alerts.length > 0 && <AlertTriangle size={14} className="text-rose-500 animate-pulse"/>}
                    
                    {student.delivery_method?.toLowerCase() === "online" && (
                      <span title="Online Lesson">
                         <Video size={12} className="text-blue-400" />
                      </span>
                    )}
                    
                    {student._isScheduledToday && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30">Today</span>}
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-1">{student.course}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-8 sm:gap-12 mt-2 sm:mt-0">
                <div className="hidden xl:block">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Skill Level</p>
                  <p className="text-sm font-bold text-purple-400 flex items-center gap-1 mt-0.5"><Target size={12}/> {student.skillLevel}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Attendance / Streak</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{student.attendance}</p>
                </div>
                <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="p-12 text-center text-slate-500 italic text-sm">No students found matching your filters.</div>
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

function ItinerarySidebar({ students, onEditLesson }: { students: any[], onEditLesson: (lessonGroup: any) => void }) {
  const [viewMode, setViewMode] = useState<'today' | 'next5'>('today');

  const aggregatedLessons = useMemo(() => {
    const now = new Date();
    const nowTs = now.getTime();
    
    const ongoingThreshold = nowTs - (60 * 60 * 1000); 
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const rawLessons = students.flatMap(student =>
      (student.schedule || []).map((lesson: any) => {
         const lessonDate = new Date(lesson.date);
         return {
            lessonId: lesson.id,
            dateObj: lessonDate,
            dateTs: lessonDate.getTime(),
            topic: lesson.topic,
            studentId: student.id,
            studentName: student.name,
            course: lesson.course || student.course, 
            delivery: lesson.delivery || student.delivery_method || 'in-person',
            location: lesson.location || '',
            link: lesson.link || null 
         };
      })
    );

    const groupedMap = new Map<string, any>();
    rawLessons.forEach(lesson => {
      const key = `${lesson.dateTs}-${lesson.topic}-${lesson.delivery}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          key: key,
          dateObj: lesson.dateObj,
          dateTs: lesson.dateTs,
          course: lesson.course,
          topic: lesson.topic,
          delivery: lesson.delivery,
          location: lesson.location,
          link: lesson.link, 
          attendees: [{ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId }]
        });
      } else {
        groupedMap.get(key).attendees.push({ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId });
      }
    });

    const groupedLessons = Array.from(groupedMap.values());
    groupedLessons.sort((a, b) => a.dateTs - b.dateTs);

    const todaysLessons = groupedLessons.filter(l => l.dateTs >= todayStart && l.dateTs < todayEnd);
    const next5Lessons = groupedLessons.filter(l => l.dateTs >= ongoingThreshold).slice(0, 5);

    return { today: todaysLessons, next5: next5Lessons };
  }, [students]);

  const displayLessons = viewMode === 'today' ? aggregatedLessons.today : aggregatedLessons.next5;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-white/5 rounded-[32px] p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Clock size={16} className="text-blue-500"/> Master Itinerary
          </h3>
        </div>

        <div className="flex bg-[#020617] rounded-xl p-1 mb-8 border border-white/5 shadow-inner">
          <button
            onClick={() => setViewMode('today')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-lg transition-all ${viewMode === 'today' ? 'bg-blue-500/20 text-blue-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            Today ({aggregatedLessons.today.length})
          </button>
          <button
            onClick={() => setViewMode('next5')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-lg transition-all ${viewMode === 'next5' ? 'bg-blue-500/20 text-blue-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            Next 5 Lessons
          </button>
        </div>
        
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:bg-white/5">
          {displayLessons.length === 0 ? (
            <div className="p-6 text-center bg-[#020617] rounded-2xl border border-dashed border-white/10 relative z-10">
              <p className="text-xs font-bold text-slate-500 italic">No scheduled lessons found for this view.</p>
            </div>
          ) : (
            displayLessons.map((lessonGroup, idx) => {
              const isOnline = lessonGroup.delivery?.toLowerCase() === 'online';
              const timeString = lessonGroup.dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              const dateString = viewMode === 'next5' ? lessonGroup.dateObj.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}) + " • " : "";
              const isMissingLogistics = (isOnline && !lessonGroup.link) || (!isOnline && !lessonGroup.location);

              return (
                <div key={`${lessonGroup.key}-${idx}`} className="relative flex gap-4 items-start group">
                  <div className={`w-6 h-6 rounded-full ${isOnline ? 'bg-blue-500/20' : 'bg-emerald-500/20'} border-2 border-[#0f172a] flex items-center justify-center z-10 shrink-0 mt-0.5`}>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-blue-400' : 'bg-emerald-400'}`}/>
                  </div>
                  <div className="flex-1 bg-[#020617] p-4 rounded-2xl border border-white/5 group-hover:border-white/10 transition-colors shadow-sm mt-[-8px]">
                    <div className="flex justify-between items-start mb-2">
                      <p className={`text-xs font-black ${isOnline ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {dateString}{timeString}
                      </p>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onEditLesson(lessonGroup)} 
                          className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors border border-transparent hover:border-white/10"
                          title="Edit Session"
                        >
                          <Edit2 size={12} />
                        </button>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          {lessonGroup.attendees.length} {lessonGroup.attendees.length === 1 ? 'Student' : 'Students'}
                        </span>
                        
                        {/* CLICKABLE LOGISTICS ICONS */}
                        {isOnline ? (
                          lessonGroup.link ? (
                            <a href={lessonGroup.link} target="_blank" rel="noopener noreferrer" className="p-1 -m-1 hover:bg-blue-500/20 rounded transition-colors" title="Join Meeting">
                              <Video size={12} className="text-blue-400 hover:text-blue-300" />
                            </a>
                          ) : (
                            <button onClick={() => onEditLesson(lessonGroup)} className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                              + Add Link
                            </button>
                          )
                        ) : (
                          lessonGroup.location ? (
                            <span title={`In-Person: ${lessonGroup.location}`} className="p-1 -m-1">
                               <MapPin size={12} className="text-emerald-500/50" />
                            </span>
                          ) : (
                            <button onClick={() => onEditLesson(lessonGroup)} className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                              + Add Venue
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight">{lessonGroup.course}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold line-clamp-1 border-b border-white/5 pb-2 mb-2">{lessonGroup.topic}</p>
                    <p className="text-xs text-slate-300 leading-tight">
                      {lessonGroup.attendees.map((a: any) => a.studentName).join(', ')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// BULK SCHEDULING MODAL
// ---------------------------------------------------------
function BulkScheduleModal({ isOpen, onClose, students, activeCourses, onSchedule }: any) {
  
  const courseTitles = activeCourses.map((c: any) => c.title).concat("Unassigned");
  const [course, setCourse] = useState(courseTitles[0] || "");
  const [delivery, setDelivery] = useState("in-person");
  const [startDate, setStartDate] = useState("");
  const [startTopic, setStartTopic] = useState("");
  
  const [isRecurring, setIsRecurring] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [reminders, setReminders] = useState({ parents: true, teacher: false });

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const eligibleStudents = useMemo(() => {
    return students.filter((s: any) => s.course === course || s.course === "Unassigned");
  }, [students, course]);

  useEffect(() => {
    if (isOpen) {
      setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
      setStartTopic(""); 
    }
  }, [course, isOpen]);

  const syllabus = useMemo(() => {
    if (course === "Unassigned") return Array.from({ length: 8 }).map((_, i) => ({ week: i + 1, title: `Standard Module ${i + 1}` }));
    const c = activeCourses.find((x: any) => x.title === course);
    const loadedSyllabus = c?.syllabus || c?.metadata?.syllabus;
    if (loadedSyllabus && Array.isArray(loadedSyllabus) && loadedSyllabus.length > 0) {
       return loadedSyllabus;
    }
    return Array.from({ length: 8 }).map((_, i) => ({ week: i + 1, title: `Standard Module ${i + 1}` }));
  }, [course, activeCourses]);

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const handleToggleAll = () => {
    if (selectedStudentIds.size === eligibleStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.size === 0 || !startDate || !startTopic) return;
    setIsSaving(true);
    await onSchedule({
      studentIds: Array.from(selectedStudentIds),
      course,
      delivery,
      startDate,
      startTopic,
      weeks: isRecurring ? weeks : 1,
      reminders
    });
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30"><CalendarDays size={24} /></div>
            <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Bulk Scheduler</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Deploy Automated Itineraries</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="lg:w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Target Course</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                  {courseTitles.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                  <option value="in-person">In-person</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6 shadow-inner">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">Starting Date & Time</label>
                <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Starting Topic</label>
                <select value={startTopic} onChange={e => setStartTopic(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                  <option value="" disabled>Select Starting Point...</option>
                  {syllabus.map(lesson => <option key={lesson.week} value={`Week ${lesson.week}: ${lesson.title}`}>Week {lesson.week} - {lesson.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-5 rounded-3xl border transition-colors cursor-pointer ${isRecurring ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`} onClick={() => setIsRecurring(!isRecurring)}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-xl ${isRecurring ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-slate-400'}`}><Repeat size={16}/></div>
                  {isRecurring ? <CheckSquare size={18} className="text-blue-400"/> : <Square size={18} className="text-slate-600"/>}
                </div>
                <p className="text-sm font-bold text-white mb-1">Recurring Weekly</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 line-clamp-2">Auto-advances syllabus topic</p>
                
                {isRecurring && (
                  <div className="mt-4 pt-4 border-t border-blue-500/20" onClick={e => e.stopPropagation()}>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Number of Weeks</label>
                    <input type="number" min="1" max="52" value={weeks} onChange={e => setWeeks(parseInt(e.target.value))} className="w-full bg-[#020617] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none" />
                  </div>
                )}
              </div>

              <div className="p-5 rounded-3xl border border-white/10 bg-white/5 flex flex-col justify-between">
                 <div>
                   <div className="flex items-center gap-2 mb-4">
                     <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400"><MessageSquare size={16}/></div>
                     <p className="text-sm font-bold text-white">Auto-Reminders</p>
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4">via WhatsApp Integration</p>
                 </div>
                 
                 <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => setReminders(p => ({...p, parents: !p.parents}))}>
                        {reminders.parents ? <CheckSquare size={16} className="text-emerald-400"/> : <Square size={16} className="text-slate-600 group-hover:text-white transition-colors"/>}
                      </div>
                      <span className="text-xs font-bold text-slate-300">Message Parents</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => setReminders(p => ({...p, teacher: !p.teacher}))}>
                        {reminders.teacher ? <CheckSquare size={16} className="text-emerald-400"/> : <Square size={16} className="text-slate-600 group-hover:text-white transition-colors"/>}
                      </div>
                      <span className="text-xs font-bold text-slate-300">Message Me (Teacher)</span>
                    </label>
                 </div>
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 flex flex-col bg-[#020617]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Select Students</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{eligibleStudents.length} eligible in {course}</p>
              </div>
              <button onClick={handleToggleAll} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors py-2 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20">
                {selectedStudentIds.size === eligibleStudents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
              {eligibleStudents.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-sm font-bold text-slate-400 italic">No active students found assigned to this course.</p>
                </div>
              ) : (
                eligibleStudents.map((s: any) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  return (
                    <div 
                      key={s.id} 
                      onClick={() => handleToggleStudent(s.id)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                    >
                      {isSelected ? <CheckSquare size={18} className="text-blue-400 shrink-0"/> : <Square size={18} className="text-slate-600 shrink-0"/>}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{s.name}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{s.course === 'Unassigned' ? 'Unassigned' : 'Enrolled'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.02] shrink-0">
               <button 
                 onClick={handleSubmit} 
                 disabled={isSaving || selectedStudentIds.size === 0 || !startDate || !startTopic}
                 className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02]"
               >
                 {isSaving ? <Loader2 size={18} className="animate-spin"/> : <><CalendarPlus size={18}/> Deploy {selectedStudentIds.size} Schedules</>}
               </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------
// NEW: EDIT LESSON MODAL
// ---------------------------------------------------------
function EditLessonModal({ isOpen, onClose, lessonGroup, students, onSave }: any) {
  const [dateStr, setDateStr] = useState("");
  const [delivery, setDelivery] = useState("in-person");
  const [logistics, setLogistics] = useState("");
  const [attendees, setAttendees] = useState<any[]>([]);
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
    }
  }, [isOpen, lessonGroup]);

  if (!isOpen || !lessonGroup) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const newDateISO = new Date(dateStr).toISOString();
    await onSave(lessonGroup, attendees, newDateISO, delivery, logistics);
    setIsSaving(false);
    onClose();
  };

  const handleAddStudent = (studentId: string) => {
    if (!studentId) return;
    const student = students.find((s: any) => s.id === studentId);
    if (student && !attendees.find(a => a.studentId === student.id)) {
       setAttendees(prev => [...prev, { studentId: student.id, studentName: student.name }]);
    }
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
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30"><Edit2 size={20} /></div>
            <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Edit Session</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 line-clamp-1">{lessonGroup.topic}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
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
                      onClick={() => setAttendees(prev => prev.filter(att => att.studentId !== a.studentId))}
                      className="text-xs font-bold text-rose-500/50 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <X size={14}/> Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* ONLY ALLOW ADDING MORE STUDENTS IF IN-PERSON */}
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
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex flex-wrap justify-between items-center gap-4 shrink-0">
          <button 
            onClick={async () => {
              if(!window.confirm("Are you sure you want to completely delete this session for ALL attendees?")) return;
              setIsSaving(true);
              await onSave(lessonGroup, [], new Date(dateStr).toISOString(), delivery, logistics);
              setIsSaving(false);
              onClose();
            }} 
            className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} /> Delete Session
          </button>
          
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button onClick={onClose} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !dateStr}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}