"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, Search, Filter, ChevronRight, Loader2, Target, 
  CalendarIcon, X, LayoutDashboard, Globe, User, Shield, 
  AlertTriangle, Video, CalendarDays, TrendingUp, CheckCircle2,
  Save, MapPin, Repeat, CalendarRange, Clock, XCircle, FileText, Zap, Trash2, ArrowLeft,
  ChevronLeft,
  UserPlus,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- EXISTING COMPONENTS (Untouched) ---
import SevenDayHorizon from "@/components/dashboard/SevenDayHorizon";
import LapsedStudentsTracker from "@/components/dashboard/LapsedStudentsTracker";
import BulkScheduleManager from "@/components/dashboard/BulkScheduleManager";
import AddSingleLessonModal from "@/components/dashboard/AddSingleLessonModal";

export default function AdminRosterHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Roster & Schedule State
  const [viewScope, setViewScope] = useState<string>('global');
  const [educators, setEducators] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [activeCourses, setActiveCourses] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  
  const [todayStudentIds, setTodayStudentIds] = useState<Set<string>>(new Set());
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);

  // Modals
  const [isBulkScheduleOpen, setIsBulkScheduleOpen] = useState(false);
  const [addingLessonDate, setAddingLessonDate] = useState<Date | null>(null);
  const [editingLessonGroup, setEditingLessonGroup] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchMasterData();
  }, [scheduleRefreshTrigger]);

  async function fetchMasterData() {
    setLoading(true);
    try {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      if (profile) setCurrentUser(profile);

      const [studentsRes, guardiansRes, enrollmentsRes, educatorsRes, availRes, coursesRes, sqlLessonsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('display_name', { ascending: true }),
        supabase.from('profiles').select('id, display_name, metadata').in('role', ['guardian', 'admin']),
        supabase.from('enrollments').select('*, courses(*)'),
        supabase.from('profiles').select('id, display_name').eq('role', 'educator').order('display_name', { ascending: true }),
        supabase.from('teacher_availability').select('*').gte('end_time', new Date().toISOString()).order('start_time', { ascending: true }),
        supabase.from('courses').select('*').eq('is_published', true).order('order_index', { ascending: true }),
        // --- NEW: Fetch the true SQL Schedule source of truth ---
        supabase.from('lesson_schedule').select('*') 
      ]);

      if (educatorsRes.data) setEducators(educatorsRes.data);
      if (availRes.data) setAvailabilities(availRes.data);
      if (coursesRes.data) setActiveCourses(coursesRes.data);

      // --- NEW: Map the SQL lessons to each student ---
      const sqlScheduleMap = new Map<string, any[]>();
      if (sqlLessonsRes.data) {
          sqlLessonsRes.data.forEach((lesson: any) => {
              const studentLessons = sqlScheduleMap.get(lesson.student_id) || [];
              studentLessons.push(lesson);
              sqlScheduleMap.set(lesson.student_id, studentLessons);
          });
      }

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

        const studentCourses = enrollmentsMap.get(s.id) || [];

        return {
          id: s.id,
          name: s.display_name || "Unknown Pioneer",
          course: studentCourses.length > 0 ? studentCourses.join(', ') : "Unassigned", 
          coursesList: studentCourses.length > 0 ? studentCourses : ["Unassigned"],
          delivery_method: studentMeta.learning_mode || "In-person",
          attendance: attendanceString,
          
          // --- CHANGED: Now pulls from the SQL table instead of legacy JSON metadata ---
          schedule: sqlScheduleMap.get(s.id) || [], 
          
          skillLevel: (s.xp || 0) > 1000 ? "Advanced" : (s.xp || 0) > 500 ? "Intermediate" : "Beginner",
          status: s.status,
          tier: studentMeta.account_tier === 'full' ? 'Term License' : 'Trial / Drop-in',
          alerts: studentMeta.medical_notes ? [studentMeta.medical_notes] : [],
          teacherId: studentMeta.teacher?.id || null,
          teacherName: studentMeta.teacher?.name || 'Unassigned',
        };
      }) || [];

      setStudents(mappedStudents);

      // Fetch Today's SQL Classes
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const { data: todayClasses } = await supabase
        .from('lesson_schedule')
        .select('student_id')
        .gte('start_time', todayStart.toISOString())
        .lt('start_time', todayEnd.toISOString());

      if (todayClasses) {
        setTodayStudentIds(new Set(todayClasses.map((row: any) => row.student_id)));
      } else {
        setTodayStudentIds(new Set());
      }
    } catch (err) {
      console.error("Error fetching master roster:", err);
    } finally {
      setLoading(false);
    }
  }

  const scopedStudents = useMemo(() => {
    if (viewScope === 'global') return students;
    return students.filter(s => s.teacherId === viewScope);
  }, [students, viewScope]);

  const scopedAvailabilities = useMemo(() => {
    if (viewScope === 'global') return availabilities;
    return availabilities.filter(a => a.teacher_id === viewScope);
  }, [availabilities, viewScope]);

  const handleSaveLessonEdits = async (lessonGroup: any, finalAttendees: any[], newDateISO: string, newDelivery: string, newLogistics: string, wrapUpData: { attendance: Record<string, string>, xp: number, note: string }) => {
    try {
      const originalAttendees = lessonGroup.attendees || [];
      const originalIds = originalAttendees.map((a: any) => a.studentId);
      const finalIds = finalAttendees.map((a: any) => a.studentId);

      const removedIds = originalIds.filter((id: string) => !finalIds.includes(id));
      const keptIds = originalIds.filter((id: string) => finalIds.includes(id));
      const addedIds = finalIds.filter((id: string) => !originalIds.includes(id));
      const isLink = newDelivery === 'online';

      // 1. UPDATE NEW SQL TABLE DIRECTLY
      const lessonIdsToUpdate = originalAttendees.map((a:any) => a.lessonId).filter(Boolean);
      if (lessonIdsToUpdate.length > 0) {
         await supabase.from('lesson_schedule').update({
            start_time: newDateISO,
            delivery_mode: newDelivery,
            location_or_link: newLogistics || null
         }).in('id', lessonIdsToUpdate);
      }

      // 2. UPDATE JSON METADATA (Backwards Compat)
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

      showToast("Lesson updated successfully!", "success");
      setScheduleRefreshTrigger(prev => prev + 1);
    } catch (err) {
      showToast("Failed to update lesson schedule.", "error");
    }
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans overflow-x-hidden text-left relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-xs md:text-sm font-black uppercase tracking-widest">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1600px] mx-auto space-y-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors mb-4">
              <ArrowLeft size={14}/> Back to Admin Hub
            </button>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">
              Master_<span className="text-blue-500">Roster</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium mt-2">Manage schedules, track lapsed students, and review deep analytics across all teachers.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <button onClick={() => router.push('/teacher/schedule')} className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all shadow-lg">
               <CalendarIcon size={14}/> Grid Schedule
             </button>
             <button onClick={() => router.push('/teacher/progress')} className="flex items-center gap-2 px-6 py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all shadow-lg">
               <TrendingUp size={14}/> Progress Matrix
             </button>
             <button onClick={() => setIsBulkScheduleOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg">
               <CalendarDays size={14}/> Bulk Schedule
             </button>
          </div>
        </header>

        <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 custom-scrollbar">
          <button onClick={() => setViewScope('global')} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === 'global' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}><Globe size={14} /> Global View</button>
          {educators.map(ed => (
            <button key={ed.id} onClick={() => setViewScope(ed.id)} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${viewScope === ed.id ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-[#0f172a] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'}`}><User size={14} /> {ed.display_name.split(' ')[0]}</button>
          ))}
        </div>

        <SevenDayHorizon 
          viewScope={viewScope} 
          currentUser={currentUser} 
          availabilities={scopedAvailabilities} 
          onEditLesson={setEditingLessonGroup} 
          onAddLesson={(date) => setAddingLessonDate(date)}
          refreshTrigger={scheduleRefreshTrigger}
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
             <AdminStudentIntelligence 
               students={scopedStudents} 
               todayStudentIds={todayStudentIds}
               educators={educators}
             />
          </div>
          <div className="xl:col-span-1">
             <LapsedStudentsTracker 
               students={scopedStudents} 
               viewScope={viewScope} 
               currentUser={currentUser} 
               refreshTrigger={scheduleRefreshTrigger} 
             />
          </div>
        </div>

      </div>

      <BulkScheduleManager isOpen={isBulkScheduleOpen} onClose={() => setIsBulkScheduleOpen(false)} students={scopedStudents} activeCourses={activeCourses} currentUser={currentUser} onSuccess={() => setScheduleRefreshTrigger(p=>p+1)} showToast={showToast} />
      <AddSingleLessonModal isOpen={!!addingLessonDate} selectedDate={addingLessonDate} onClose={() => setAddingLessonDate(null)} students={scopedStudents} activeCourses={activeCourses} currentUser={currentUser} onSuccess={() => setScheduleRefreshTrigger(p=>p+1)} showToast={showToast} />
      <EditLessonModal isOpen={!!editingLessonGroup} lessonGroup={editingLessonGroup} students={scopedStudents} onClose={() => setEditingLessonGroup(null)} onSave={handleSaveLessonEdits} showToast={showToast} />

    </div>
  );
}

// ==========================================
// ADMIN STUDENT INTELLIGENCE (Custom God-Mode View)
// ==========================================

function AdminStudentIntelligence({ students, todayStudentIds, educators }: { students: any[], todayStudentIds: Set<string>, educators: any[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("All Tiers");
  const [teacherFilter, setTeacherFilter] = useState("All Teachers");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // --- NEW: Filter out dormant or unassigned accounts ---
      const hasCurrentTier = s.status === 'active' && s.course !== 'Unassigned';
      if (!hasCurrentTier) return false;

      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = tierFilter === "All Tiers" || s.tier === tierFilter;
      const matchesTeacher = teacherFilter === "All Teachers" || s.teacherName === teacherFilter;
      s._isScheduledToday = todayStudentIds.has(s.id);

      return matchesSearch && matchesTier && matchesTeacher;
    });
  }, [students, searchQuery, tierFilter, teacherFilter, todayStudentIds]);

  useMemo(() => setCurrentPage(1), [searchQuery, tierFilter, teacherFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, filteredStudents.length);

  return (
    <div className="space-y-6 flex flex-col h-full min-h-[700px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2">
          <Shield className="text-blue-500"/> God-Mode Intelligence
        </h2>
        <div className="relative w-full sm:w-72 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
          <input 
            type="text" placeholder="Search roster..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 shadow-inner"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-[24px] shrink-0">
        <div className="flex items-center gap-2 text-slate-400"><Filter size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Filters:</span></div>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="bg-[#020617] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none appearance-none">
          <option value="All Tiers">All Tiers</option>
          <option value="Term License">Term License</option>
          <option value="Trial / Drop-in">Trial / Drop-in</option>
        </select>
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="bg-[#020617] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none appearance-none">
          <option value="All Teachers">All Teachers</option>
          {educators.map(e => <option key={e.id} value={e.display_name}>{e.display_name}</option>)}
          <option value="Unassigned">Unassigned</option>
        </select>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl flex flex-col flex-1">
        <div className="divide-y divide-white/5 flex-1 overflow-y-auto custom-scrollbar">
          {paginatedStudents.map((student) => (
            <div key={student.id} className="p-5 transition-all hover:bg-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-sm font-black text-white shrink-0">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-white leading-none truncate max-w-full">{student.name}</h3>
                    {student.alerts.length > 0 && <AlertTriangle size={12} className="text-rose-500 shrink-0"/>}
                    {student._isScheduledToday && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">Class Today</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-slate-500">
                    <span className={student.tier === 'Term License' ? 'text-emerald-400' : 'text-purple-400'}>{student.tier}</span> • 
                    <span>{student.teacherName}</span> • 
                    <span className="truncate">{student.course}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-end w-full sm:w-auto gap-3 shrink-0 border-t sm:border-0 border-white/5 pt-3 sm:pt-0">
                
                {/* --- NEW: ATTENDANCE & PENDING METRIC --- */}
                {(() => {
                  const pastLessons = student.schedule?.filter((l: any) => new Date(l.date || l.start_time).getTime() < Date.now()) || [];
                  const takenPlace = pastLessons.length;
                  const attended = pastLessons.filter((l: any) => ['attended', 'present', 'late'].includes((l.attendance_status || '').toLowerCase())).length;
                  const pendingCount = pastLessons.filter((l: any) => !l.attendance_status || ['pending', 'rescheduled'].includes((l.attendance_status).toLowerCase())).length;

                  return (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${pendingCount > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                      <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 size={12} className={pendingCount > 0 ? 'text-amber-400' : 'text-emerald-500'} /> 
                        {attended} / {takenPlace} Attended
                      </span>
                      {pendingCount > 0 && (
                        <>
                          <span className="w-px h-3 bg-amber-500/30"></span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 animate-pulse flex items-center gap-1">
                            <AlertTriangle size={10} /> {pendingCount} Pending
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}

                <button onClick={() => router.push(`/admin/student/${student.id}`)} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg transition-colors">
                  Full Config
                </button>
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="p-12 text-center text-slate-500 italic text-sm font-bold">No students found matching your God-Mode filters.</div>
          )}
        </div>
        
        {filteredStudents.length > 0 && (
          <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Showing {startIdx} - {endIdx} of {filteredStudents.length} Students</p>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-slate-400 px-4">Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SHARED MODAL (Same as Teacher View)
// ==========================================
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
      setDateStr((new Date(d.getTime() - tzOffset)).toISOString().slice(0,16));
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
    await onSave(lessonGroup, attendees, new Date(dateStr).toISOString(), delivery, logistics, { attendance, xp: sessionXp, note: sessionNote });
    setIsSaving(false);
    onClose();
  };

  const handleAddStudent = (studentId: string) => {
    if (!studentId) return;
    const student = students.find((s: any) => s.id === studentId);
    if (student && !attendees.find(a => a.studentId === student.id)) {
       setAttendees((prev: any[]) => [...prev, { studentId: student.id, studentName: student.name, lessonId: null }]);
    }
  };

  const availableToAdd = students.filter((s: any) => !attendees.find(a => a.studentId === s.id));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl"><LayoutDashboard size={20} /></div>
            <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Admin Override</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{lessonGroup.topic}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex p-2 bg-[#020617] border-b border-white/5 shrink-0 gap-2">
          <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'details' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><CalendarRange size={14}/> Logistics</button>
          <button onClick={() => setActiveTab('wrapup')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'wrapup' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}><CheckCircle2 size={14}/> Force Roll-Call</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'details' ? (
              <motion.div key="details" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">Date & Time</label>
                  <input type="datetime-local" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                      <select value={delivery} onChange={e => { setDelivery(e.target.value); setLogistics(""); }} className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                        <option value="in-person">In-Person</option>
                        <option value="online">Online</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Venue / Link</label>
                      <input type={delivery === 'online' ? 'url' : 'text'} value={logistics} onChange={e => setLogistics(e.target.value)} placeholder={delivery === 'online' ? "https://zoom.us/..." : "e.g. Lab 1"} className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500" />
                   </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Manage Attendees</label><span className="text-[9px] font-black bg-white/5 px-2 py-1 rounded text-slate-400">{attendees.length} Students</span></div>
                  <div className="bg-[#020617] border border-white/5 rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {attendees.map((a: any) => (
                      <div key={a.studentId} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl group">
                        <div className="flex flex-col min-w-0 pr-4">
                           <span className="text-sm font-bold text-white truncate">{a.studentName}</span>
                           <span className="text-[8px] text-slate-500 font-mono tracking-widest mt-1 uppercase">tbl: lesson_schedule <br/> id: <span className="text-blue-400 select-all">{a.lessonId || 'Pending Creation'}</span></span>
                        </div>
                        <button onClick={() => setAttendees((p: any[]) => p.filter(att => att.studentId !== a.studentId))} className="text-xs font-bold text-rose-500/50 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  {availableToAdd.length > 0 && (
                     <div className="bg-[#0f172a] border border-blue-500/20 rounded-2xl p-4">
                       <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1"><UserPlus size={10}/> Force Add Student</label>
                       <select value="" onChange={e => handleAddStudent(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 appearance-none">
                          <option value="" disabled>Select a student to inject...</option>
                          {availableToAdd.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                     </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="wrapup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="p-6 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> Force Roster Roll-Call</label>
                  <div className="space-y-3">
                    {attendees.map((a: any) => {
                      const currentStatus = attendance[a.studentId];
                      return (
                        <div key={a.studentId} className="bg-[#020617] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
                          <span className="text-sm font-black text-white">{a.studentName}</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['present', 'absent', 'late', 'rescheduled'].map(status => (
                              <button key={status} onClick={() => setAttendance(p => ({ ...p, [a.studentId]: status }))} className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex justify-center items-center gap-1 ${currentStatus === status ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'}`}>
                                {currentStatus === status && <Check size={10}/>} {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex flex-wrap justify-between items-center gap-4 shrink-0">
          <button onClick={async () => { if(window.confirm("Delete session for ALL attendees?")) { setIsSaving(true); await onSave(lessonGroup, [], new Date(dateStr).toISOString(), delivery, logistics, { attendance: {}, xp: 0, note: '' }); setIsSaving(false); onClose(); } }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-2"><Trash2 size={14} /> Delete</button>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button onClick={onClose} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancel</button>
            <button onClick={handleSave} disabled={isSaving || !dateStr} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase italic text-xs tracking-widest flex gap-2 shadow-lg disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Force Update
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}