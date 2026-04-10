"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, Calendar, Activity, AlertTriangle, Search, Filter, 
  ChevronRight, Phone, Mail, Target, BookOpen, 
  MessageSquare, Shield, Clock, Plus, Zap, Laptop,
  CheckCircle2, ChevronLeft, CalendarCheck, Loader2, X, Edit2, Save, MapPin, Video, CalendarPlus,
  CalendarDays, Repeat, CheckSquare, Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [activeStudent, setActiveStudent] = useState<any | null>(null);
  const [metricDrilldown, setMetricDrilldown] = useState<string | null>(null);
  const [isBulkScheduleOpen, setIsBulkScheduleOpen] = useState(false);
  
  const [students, setStudents] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>(AVAILABLE_COURSES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [studentsRes, guardiansRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('display_name', { ascending: true }),
        supabase.from('profiles').select('id, display_name, metadata').in('role', ['guardian', 'admin']),
        supabase.from('courses').select('*') 
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (guardiansRes.error) throw guardiansRes.error;

      if (coursesRes.data) {
        const activeCourses = coursesRes.data
          .filter((c: any) => {
             const status = (c.status || '').toLowerCase();
             return status === 'published' || status === 'private' || c.is_published === true || (!c.status && c.is_published === undefined);
          })
          .map((c: any) => c.title || c.name) 
          .filter(Boolean);
        
        setAvailableCourses(activeCourses.length > 0 ? activeCourses : AVAILABLE_COURSES);
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

        const course = (studentMeta.interested_programs && studentMeta.interested_programs.length > 0) 
          ? studentMeta.interested_programs[0] 
          : "Unassigned";

        return {
          id: s.id,
          student_identifier: s.student_identifier,
          name: s.display_name || "Unknown Pioneer",
          age: age,
          course: course,
          delivery_method: studentMeta.delivery_method || "In-person",
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

  // --- CORE METADATA UPDATE ENGINE ---
  const updateStudentMetadata = async (studentId: string, updates: Record<string, any>) => {
    try {
      const { data: profile, error: fetchErr } = await supabase.from('profiles').select('metadata').eq('id', studentId).single();
      if (fetchErr) throw fetchErr;

      const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
      const newMeta = { ...meta, ...updates };

      const { error: updateErr } = await supabase.from('profiles').update({ metadata: newMeta }).eq('id', studentId);
      if (updateErr) throw updateErr;

      setStudents((prev: any[]) => prev.map(s => s.id === studentId ? { ...s, ...updates, course: updates.interested_programs ? updates.interested_programs[0] : s.course } : s));
      
      if (activeStudent && activeStudent.id === studentId) {
        setActiveStudent((prev: any) => ({ ...prev, ...updates, course: updates.interested_programs ? updates.interested_programs[0] : prev.course }));
      }
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
      throw err;
    }
  };

  const handleAssignCourse = async (studentId: string, newCourse: string, newDelivery: string) => {
    await updateStudentMetadata(studentId, { 
      interested_programs: [newCourse],
      delivery_method: newDelivery 
    });
  };

  const handleScheduleLesson = async (studentId: string, currentSchedule: any[], newLesson: any) => {
    await updateStudentMetadata(studentId, { 
      schedule: [...currentSchedule, { id: Math.random().toString(36).substring(7), ...newLesson }] 
    });
  };

  const handleDeleteLesson = async (studentId: string, currentSchedule: any[], lessonIdToDelete: string) => {
    await updateStudentMetadata(studentId, { 
      schedule: currentSchedule.filter(l => l.id !== lessonIdToDelete) 
    });
  };

  // --- BULK SCHEDULER ENGINE ---
  const handleBulkSchedule = async (params: { studentIds: string[], course: string, delivery: string, startDate: string, startTopic: string, weeks: number, reminders: any }) => {
    const syllabus = getSyllabusForCourse(params.course);
    const startIdx = Math.max(0, syllabus.findIndex(l => `Week ${l.week}: ${l.title}` === params.startTopic));
    const startDt = new Date(params.startDate);

    const lessonsToCreate: any[] = [];

    // Auto-advancing recurring logic
    for (let i = 0; i < params.weeks; i++) {
      const lessonDate = new Date(startDt);
      lessonDate.setDate(lessonDate.getDate() + (i * 7)); // Add i weeks

      const topicObj = syllabus[startIdx + i];
      const topicStr = topicObj ? `Week ${topicObj.week}: ${topicObj.title}` : "TBD / Open Session";

      lessonsToCreate.push({
        id: Math.random().toString(36).substring(7),
        date: lessonDate.toISOString(),
        topic: topicStr,
        reminders: params.reminders
      });
    }

    // Process updates in parallel
    await Promise.all(params.studentIds.map(async (id) => {
      const student = students.find(s => s.id === id);
      if(!student) return;

      const currentSchedule = student.schedule || [];
      const newSchedule = [...currentSchedule, ...lessonsToCreate];

      const { data: profile, error: fetchErr } = await supabase.from('profiles').select('metadata').eq('id', id).single();
      if (!fetchErr) {
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        meta.schedule = newSchedule;
        meta.delivery_method = params.delivery; 
        if (!meta.interested_programs || meta.interested_programs[0] !== params.course) {
          meta.interested_programs = [params.course];
        }
        await supabase.from('profiles').update({ metadata: meta }).eq('id', id);
      }
    }));

    // Batch update UI
    setStudents(prev => prev.map(s => {
      if (params.studentIds.includes(s.id)) {
        return {
          ...s,
          course: params.course,
          delivery_method: params.delivery,
          schedule: [...(s.schedule || []), ...lessonsToCreate]
        };
      }
      return s;
    }));
  };

  const todayClassesCount = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    
    const uniqueClasses = new Set<string>();
    students.forEach(s => {
      if (s.schedule) {
        s.schedule.forEach((lesson: any) => {
          const t = new Date(lesson.date).getTime();
          if (t >= todayStart && t < todayEnd) {
            uniqueClasses.add(`${t}-${s.course}-${s.delivery_method}`);
          }
        });
      }
    });
    return uniqueClasses.size;
  }, [students]);

  const metrics = {
    totalStudents: students.length,
    activeStreaks: students.filter(s => s.attendance.includes('Streak')).length,
    upcomingClasses: todayClassesCount, 
    activeAlerts: students.filter(s => s.alerts.length > 0).length
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
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-500">
              <Shield size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Instructional_Command</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
              Educator_<span className="text-purple-500">Portal</span>
            </h1>
            <p className="text-slate-400 font-medium mt-2">Welcome back. You have {metrics.upcomingClasses} unique class sessions scheduled today.</p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setIsBulkScheduleOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-slate-300"
            >
              <CalendarDays size={14}/> Bulk Schedule
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20">
              <CheckCircle2 size={14}/> Log Attendance
            </button>
          </div>
        </header>

        {/* HERO METRICS */}
        <HeroMetrics metrics={metrics} onDrilldown={setMetricDrilldown} />

        {/* WORKSPACE AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          <div className="lg:col-span-2">
             <StudentIntelligence students={students} onSelectStudent={setActiveStudent} />
          </div>
          <div className="lg:col-span-1">
             <ItinerarySidebar students={students} />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <MetricDrilldownModal metric={metricDrilldown} students={students} onClose={() => setMetricDrilldown(null)} onSelectStudent={setActiveStudent} />
      
      <StudentDossier 
        student={activeStudent} onClose={() => setActiveStudent(null)} 
        onAssignCourse={handleAssignCourse} onScheduleLesson={handleScheduleLesson} onDeleteLesson={handleDeleteLesson}
        availableCourses={availableCourses}
      />

      <BulkScheduleModal
        isOpen={isBulkScheduleOpen} onClose={() => setIsBulkScheduleOpen(false)}
        students={students} availableCourses={availableCourses} onSchedule={handleBulkSchedule}
      />

    </div>
  );
}


// ==========================================
// SUB-COMPONENTS
// ==========================================

function HeroMetrics({ metrics, onDrilldown }: { metrics: any, onDrilldown: (metric: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      <div onClick={() => onDrilldown('all')} className="bg-gradient-to-br from-purple-500/10 to-[#020617] border border-purple-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-purple-500/50 hover:scale-[1.02] transition-all group">
        <Users className="absolute -right-4 -bottom-4 text-purple-500/10 group-hover:text-purple-500/20 transition-colors" size={80} />
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Active Roster</p>
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

function MetricDrilldownModal({ metric, students, onClose, onSelectStudent }: { metric: string | null, students: any[], onClose: () => void, onSelectStudent: (s: any) => void }) {
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
    title = "Full Active Roster";
    icon = <Users size={24} className="text-purple-400"/>;
  }

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
                        <tr key={s.id} onClick={() => { onClose(); onSelectStudent(s); }} className="hover:bg-white/5 cursor-pointer transition-colors group">
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

function StudentIntelligence({ students, onSelectStudent }: { students: any[], onSelectStudent: (student: any) => void }) {
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
              onClick={() => onSelectStudent(student)}
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
                    {student.delivery_method === "Online" && <Video size={12} className="text-blue-400"/>}
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

function ItinerarySidebar({ students }: { students: any[] }) {
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
            id: lesson.id,
            dateObj: lessonDate,
            dateTs: lessonDate.getTime(),
            topic: lesson.topic,
            studentName: student.name,
            course: student.course,
            delivery: student.delivery_method || 'In-person'
         };
      })
    );

    const groupedMap = new Map<string, any>();
    rawLessons.forEach(lesson => {
      const key = `${lesson.dateTs}-${lesson.course}-${lesson.delivery}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: lesson.id,
          dateObj: lesson.dateObj,
          dateTs: lesson.dateTs,
          course: lesson.course,
          topic: lesson.topic,
          delivery: lesson.delivery,
          students: [lesson.studentName]
        });
      } else {
        groupedMap.get(key).students.push(lesson.studentName);
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
            displayLessons.map((lesson, idx) => {
              const isOnline = lesson.delivery === 'Online';
              const timeString = lesson.dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              const dateString = viewMode === 'next5' ? lesson.dateObj.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}) + " • " : "";

              return (
                <div key={`${lesson.id}-${idx}`} className="relative flex gap-4 items-start group">
                  <div className={`w-6 h-6 rounded-full ${isOnline ? 'bg-purple-500/20' : 'bg-blue-500/20'} border-2 border-[#0f172a] flex items-center justify-center z-10 shrink-0 mt-0.5`}>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-purple-400' : 'bg-blue-400'}`}/>
                  </div>
                  <div className="flex-1 bg-[#020617] p-4 rounded-2xl border border-white/5 group-hover:border-white/10 transition-colors shadow-sm mt-[-8px]">
                    <div className="flex justify-between items-start mb-2">
                      <p className={`text-xs font-black ${isOnline ? 'text-purple-400' : 'text-blue-400'}`}>
                        {dateString}{timeString}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          {lesson.students.length} {lesson.students.length === 1 ? 'Student' : 'Students'}
                        </span>
                        {isOnline ? <Video size={12} className="text-purple-500/50" /> : <MapPin size={12} className="text-blue-500/50" />}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight">{lesson.course}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold line-clamp-1 border-b border-white/5 pb-2 mb-2">{lesson.topic}</p>
                    <p className="text-xs text-slate-300 leading-tight">{lesson.students.join(', ')}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-rose-500/5 border border-rose-500/20 rounded-[32px] p-8 shadow-xl">
        <h3 className="text-sm font-black uppercase tracking-widest text-rose-400 flex items-center gap-2 mb-4">
          <AlertTriangle size={16}/> Active Alerts
        </h3>
        <div className="space-y-3">
          <div className="p-4 text-center text-xs text-slate-500 italic">
            No medical or pickup alerts for today's classes.
          </div>
        </div>
      </div>
   </div>
  );
}

function StudentDossier({ student, onClose, onAssignCourse, onScheduleLesson, onDeleteLesson, availableCourses }: any) {
  const [cachedStudent, setCachedStudent] = useState<any>(null);
  
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState("In-person");
  const [isSaving, setIsSaving] = useState(false);

  const [isScheduling, setIsScheduling] = useState(false);
  const [newLessonDate, setNewLessonDate] = useState("");
  const [newLessonTopic, setNewLessonTopic] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  useEffect(() => {
    if (student) {
      setCachedStudent(student);
      setSelectedCourse(student.course);
      setSelectedDelivery(student.delivery_method || "In-person");
      setIsEditingCourse(false);
      setIsScheduling(false);
    }
  }, [student]);

  const displayStudent = student || cachedStudent;

  const handleSaveCourse = async () => {
    if (!displayStudent) return;
    setIsSaving(true);
    await onAssignCourse(displayStudent.id, selectedCourse, selectedDelivery);
    setIsSaving(false);
    setIsEditingCourse(false);
  };

  const handleSaveLesson = async () => {
    if (!displayStudent || !newLessonDate || !newLessonTopic) return;
    setIsSavingSchedule(true);
    await onScheduleLesson(displayStudent.id, displayStudent.schedule || [], {
      date: newLessonDate,
      topic: newLessonTopic,
      reminders: { parents: true, teacher: true }
    });
    setIsSavingSchedule(false);
    setIsScheduling(false);
    setNewLessonDate("");
    setNewLessonTopic("");
  };

  if (!displayStudent) return null;

  const syllabus = getSyllabusForCourse(displayStudent.course);
  const schedule = displayStudent.schedule || [];

  return (
    <AnimatePresence>
      {student && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="relative w-full max-w-2xl bg-[#020617] border-l border-white/10 h-full shadow-2xl flex flex-col overflow-y-auto custom-scrollbar">
            
            <div className="p-8 md:p-10 border-b border-white/5 bg-[#0f172a]/50 relative shrink-0">
              <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-slate-400 hover:text-white"><X size={20}/></button>
              
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-purple-500/20 shrink-0">
                  {displayStudent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tight text-white leading-none">{displayStudent.name}</h2>
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-[0.2em] mt-2">{displayStudent.student_identifier || displayStudent.id.substring(0,8)} &bull; Age {displayStudent.age}</p>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-10 space-y-8 flex-1">
              {/* CURRENT PROGRAM WIDGET */}
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Assignment</p>
                  {!isEditingCourse && (
                    <button onClick={() => setIsEditingCourse(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-white transition-colors" title="Edit Assignment">
                      <Edit2 size={12} /> Edit Profile
                    </button>
                  )}
                </div>

                {isEditingCourse ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Syllabus / Course</label>
                        <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 appearance-none">
                          {availableCourses.map((c: string) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Delivery Method</label>
                        <select value={selectedDelivery} onChange={e => setSelectedDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 appearance-none">
                          <option value="In-person">In-person</option>
                          <option value="Online">Online</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                      <button onClick={() => { setIsEditingCourse(false); setSelectedCourse(displayStudent.course); setSelectedDelivery(displayStudent.delivery_method); }} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                      <button onClick={handleSaveCourse} disabled={isSaving} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                        {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save Updates
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="font-bold text-lg text-white leading-none">{displayStudent.course}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {displayStudent.delivery_method === 'Online' ? (
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Video size={10}/> Online Class</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><MapPin size={10}/> In-Person</span>
                        )}
                        <span className="px-2 py-1 bg-white/5 text-slate-400 border border-white/10 rounded text-[9px] font-black uppercase tracking-widest">
                          {displayStudent.attendance}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TERM SCHEDULER WIDGET */}
              <div className="bg-[#0f172a] border border-white/5 rounded-3xl p-6 shadow-2xl">
                 <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                   <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2"><Calendar size={16} className="text-blue-500"/> Term Schedule</h3>
                   {!isScheduling && (
                     <button onClick={() => setIsScheduling(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors">
                       <Plus size={12}/> Single Booking
                     </button>
                   )}
                 </div>

                 {isScheduling && (
                   <div className="bg-[#020617] border border-blue-500/30 p-5 rounded-2xl mb-6 space-y-4">
                     <div className="space-y-1">
                       <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Lesson Date & Time</label>
                       <input type="datetime-local" value={newLessonDate} onChange={e => setNewLessonDate(e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500" />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Syllabus Topic</label>
                       <select value={newLessonTopic} onChange={e => setNewLessonTopic(e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                         <option value="" disabled>Select Lesson Topic...</option>
                         {syllabus.map(lesson => <option key={lesson.week} value={`Week ${lesson.week}: ${lesson.title}`}>Week {lesson.week} - {lesson.title}</option>)}
                       </select>
                     </div>
                     <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setIsScheduling(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSaveLesson} disabled={isSavingSchedule || !newLessonDate || !newLessonTopic} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                          {isSavingSchedule ? <Loader2 size={14} className="animate-spin"/> : <CalendarPlus size={14}/>} Confirm Booking
                        </button>
                     </div>
                   </div>
                 )}

                 <div className="space-y-3">
                   {schedule.length === 0 ? (
                     <div className="p-6 text-center border border-dashed border-white/10 rounded-2xl">
                       <p className="text-xs font-bold text-slate-500 italic">No upcoming lessons scheduled for this term.</p>
                     </div>
                   ) : (
                     schedule.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((lesson: any) => (
                       <div key={lesson.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#020617] border border-white/5 rounded-2xl hover:border-blue-500/30 transition-colors group">
                         <div className="flex items-start gap-4">
                           <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-400 shrink-0 border border-blue-500/20">
                             <Clock size={16} />
                           </div>
                           <div>
                             <p className="text-sm font-bold text-white leading-tight">{lesson.topic}</p>
                             <p className="text-xs font-bold text-slate-500 mt-1">{new Date(lesson.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                           </div>
                         </div>
                         <button onClick={() => onDeleteLesson(displayStudent.id, schedule, lesson.id)} className="text-[10px] font-black uppercase tracking-widest text-rose-500/50 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                           Remove
                         </button>
                       </div>
                     ))
                   )}
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------
// NEW: BULK SCHEDULING MODAL
// ---------------------------------------------------------
function BulkScheduleModal({ isOpen, onClose, students, availableCourses, onSchedule }: any) {
  const [course, setCourse] = useState(availableCourses[0] || "");
  const [delivery, setDelivery] = useState("In-person");
  const [startDate, setStartDate] = useState("");
  const [startTopic, setStartTopic] = useState("");
  
  const [isRecurring, setIsRecurring] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [reminders, setReminders] = useState({ parents: true, teacher: false });

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Derive eligible students based on the selected course
  const eligibleStudents = useMemo(() => {
    return students.filter((s: any) => s.course === course || s.course === "Unassigned");
  }, [students, course]);

  // Auto-select eligible students when course changes
  useEffect(() => {
    if (isOpen) {
      setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
      setStartTopic(""); 
    }
  }, [course, isOpen]); // removed eligibleStudents to prevent infinite loop of selections

  const syllabus = getSyllabusForCourse(course);

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
          
          {/* LEFT COLUMN: CONFIGURATION */}
          <div className="lg:w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-8">
            
            {/* Context */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Target Course</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                  {availableCourses.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                  <option value="In-person">In-person</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            </div>

            {/* Time & Topic */}
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

            {/* Automation Options */}
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

          {/* RIGHT COLUMN: STUDENTS */}
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