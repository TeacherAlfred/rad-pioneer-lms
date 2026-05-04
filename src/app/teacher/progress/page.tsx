"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Filter, Trophy, Target, 
  CalendarCheck, Loader2, LayoutDashboard,
  TrendingUp, Award, Sigma, ChevronRight,
  Activity, ArrowDown, ArrowUp, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function StudentProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'xp', direction: 'desc' });

  useEffect(() => {
    fetchProgressData();
  }, []);

  async function fetchProgressData() {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, display_name, xp, sparks, metadata')
        .eq('role', 'student');
      if (profilesErr) throw profilesErr;

      // 2. Fetch Enrollments
      const { data: enrollmentsData, error: enrollmentsErr } = await supabase
        .from('enrollments')
        .select('student_id, course_id, status, courses(id, title)');
      if (enrollmentsErr) throw enrollmentsErr;

      // 3. Fetch Course Structures (FIX: Now pulling 'unlock_date' from modules)
      const { data: coursesData, error: coursesErr } = await supabase
        .from('courses')
        .select('id, modules(id, unlock_date, missions(id))');
      if (coursesErr) throw coursesErr;

      // 4. Fetch Completed Missions
      const { data: techArchiveData, error: archiveErr } = await supabase
        .from('tech_archive')
        .select('student_id, mission_id')
        .eq('status', 'completed');
      if (archiveErr) throw archiveErr;

      // 5. Fetch Passed Quizzes
      const { data: quizData, error: quizErr } = await supabase
        .from('quiz_attempts')
        .select('student_id, module_id')
        .eq('passed', true);
      if (quizErr) throw quizErr;

      // --- MAP COURSE TOTALS (ONLY UNLOCKED CONTENT) ---
      const now = new Date().getTime();
      const courseTotals: Record<string, { totalUnlockedTasks: number }> = {};
      
      (coursesData || []).forEach((course: any) => {
        let unlockedCount = 0;
        
        (course.modules || []).forEach((mod: any) => {
          // Check if the module has no lock, or if the lock date has passed
          const isUnlocked = !mod.unlock_date || new Date(mod.unlock_date).getTime() <= now;
          
          if (isUnlocked) {
            unlockedCount += 1; // Add 1 for the module's checkpoint/quiz
            unlockedCount += (mod.missions || []).length; // Add the module's missions
          }
        });
        
        courseTotals[course.id] = { totalUnlockedTasks: unlockedCount };
      });

      // --- MAP STUDENT ACCOMPLISHMENTS ---
      const studentCompletedMissions: Record<string, Set<string>> = {};
      (techArchiveData || []).forEach((row: any) => {
        if (!studentCompletedMissions[row.student_id]) studentCompletedMissions[row.student_id] = new Set();
        studentCompletedMissions[row.student_id].add(row.mission_id);
      });

      const studentPassedQuizzes: Record<string, Set<string>> = {};
      (quizData || []).forEach((row: any) => {
        if (!studentPassedQuizzes[row.student_id]) studentPassedQuizzes[row.student_id] = new Set();
        studentPassedQuizzes[row.student_id].add(row.module_id);
      });

      // --- BUILD FINAL STUDENT ARRAY ---
      const processedStudents = (profilesData || []).map(student => {
        const meta = typeof student.metadata === 'string' ? JSON.parse(student.metadata) : (student.metadata || {});
        
        const myEnrollments = (enrollmentsData || []).filter(e => e.student_id === student.id && e.status === 'active');
        const primaryEnrollment = myEnrollments.length > 0 ? myEnrollments[0] : null;
        
        const coursesObj: any = primaryEnrollment?.courses;
        const courseTitle = Array.isArray(coursesObj) 
          ? (coursesObj[0]?.title || "Unassigned") 
          : (coursesObj?.title || "Unassigned");

        // --- DYNAMIC ON-TRACK CALCULATION ---
        let onTrackRate = 0;
        if (primaryEnrollment?.course_id) {
          const totals = courseTotals[primaryEnrollment.course_id];
          // Only calculate if there is actually unlocked content available
          if (totals && totals.totalUnlockedTasks > 0) {
            const myMissions = studentCompletedMissions[student.id]?.size || 0;
            const myQuizzes = studentPassedQuizzes[student.id]?.size || 0;
            onTrackRate = Math.round(((myMissions + myQuizzes) / totals.totalUnlockedTasks) * 100);
          }
        } else {
           onTrackRate = meta.course_progress || 0;
        }

        const attended = meta.lessons_attended || 0;
        const scheduled = meta.lessons_scheduled || 0;
        const attendanceRate = scheduled > 0 ? Math.round((attended / scheduled) * 100) : (meta.attendance_rate || 100);

        return {
          id: student.id,
          name: student.display_name || "Unknown Pioneer",
          course: courseTitle,
          xp: student.xp || 0,
          mathPoints: student.sparks || 0,
          courseProgress: onTrackRate > 100 ? 100 : onTrackRate, // Cap at 100% just in case
          attendanceRate: attendanceRate,
          alerts: meta.medical_notes ? 1 : 0
        };
      });

      setStudents(processedStudents);

    } catch (error: any) {
      console.error("Error fetching progress telemetry:", error.message || error);
    } finally {
      setLoading(false);
    }
  }
  // --- Filtering & Sorting Logic ---
  const availableCourses = useMemo(() => {
    const courses = new Set(students.map(s => s.course));
    return ["all", ...Array.from(courses)];
  }, [students]);

  const displayedStudents = useMemo(() => {
    let result = [...students];

    // Filter Course
    if (courseFilter !== 'all') {
      result = result.filter(s => s.course === courseFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lowerQ));
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [students, courseFilter, searchQuery, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // --- Aggregated Hero Metrics ---
  const macroStats = useMemo(() => {
    if (displayedStudents.length === 0) return { avgProgress: 0, avgAttendance: 0, topMath: "-", topXP: "-" };
    
    const sumProgress = displayedStudents.reduce((sum, s) => sum + s.courseProgress, 0);
    const sumAttendance = displayedStudents.reduce((sum, s) => sum + s.attendanceRate, 0);
    
    const topMathStudent = [...displayedStudents].sort((a, b) => b.mathPoints - a.mathPoints)[0];
    const topXPStudent = [...displayedStudents].sort((a, b) => b.xp - a.xp)[0];

    return {
      avgProgress: Math.round(sumProgress / displayedStudents.length),
      avgAttendance: Math.round(sumAttendance / displayedStudents.length),
      topMath: topMathStudent?.mathPoints > 0 ? topMathStudent.name : "N/A",
      topXP: topXPStudent?.xp > 0 ? topXPStudent.name : "N/A"
    };
  }, [displayedStudents]);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-purple-400 font-black uppercase tracking-[0.3em] text-[10px]">Compiling_Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="space-y-4">
            <Link href="/teacher/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-purple-500/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Teacher Dashboard</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-500">
                <Activity size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Academic_Telemetry</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">
                Student <span className="text-purple-500">Progress</span>
              </h1>
            </div>
          </div>
        </header>

        {/* HERO METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-[#020617] border border-blue-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
            <Target className="absolute -right-4 -bottom-4 text-blue-500/10" size={80} />
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Avg On-Track %</p>
            <p className="text-4xl font-black text-white tracking-tighter">{macroStats.avgProgress}%</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500/10 to-[#020617] border border-emerald-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
            <CalendarCheck className="absolute -right-4 -bottom-4 text-emerald-500/10" size={80} />
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Avg Attendance</p>
            <p className="text-4xl font-black text-white tracking-tighter">{macroStats.avgAttendance}%</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-[#020617] border border-purple-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
            <Trophy className="absolute -right-4 -bottom-4 text-purple-500/10" size={80} />
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Highest XP Scorer</p>
            <p className="text-xl font-bold text-white tracking-tight mt-2 truncate">{macroStats.topXP}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-[#020617] border border-amber-500/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
            <Sigma className="absolute -right-4 -bottom-4 text-amber-500/10" size={80} />
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Math Lab Leader</p>
            <p className="text-xl font-bold text-white tracking-tight mt-2 truncate">{macroStats.topMath}</p>
          </div>
        </div>

        {/* DATA MATRIX CONTROLS */}
        <div className="bg-[#0f172a] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
          
          {/* TOOLBAR */}
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02]">
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search student name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-purple-500 transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-slate-400">
                <Filter size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Filter:</span>
              </div>
              <select 
                value={courseFilter} 
                onChange={e => setCourseFilter(e.target.value)}
                className="flex-1 md:flex-none bg-[#020617] border border-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-2xl px-4 py-3 outline-none focus:border-purple-500 shadow-sm cursor-pointer appearance-none"
              >
                {availableCourses.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Courses' : c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TELEMETRY TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#020617] text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                <tr>
                  <th className="px-8 py-5 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">Student {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('courseProgress')}>
                    <div className="flex items-center gap-2"><Target size={14}/> On-Track % {sortConfig.key === 'courseProgress' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => handleSort('attendanceRate')}>
                    <div className="flex items-center gap-2"><CalendarCheck size={14}/> Attendance {sortConfig.key === 'attendanceRate' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:text-purple-400 transition-colors" onClick={() => handleSort('xp')}>
                    <div className="flex items-center gap-2"><Trophy size={14}/> Pioneer XP {sortConfig.key === 'xp' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                  </th>
                  <th className="px-8 py-5 cursor-pointer hover:text-amber-400 transition-colors text-right justify-end" onClick={() => handleSort('mathPoints')}>
                    <div className="flex items-center justify-end gap-2"><Sigma size={14}/> Math Lab {sortConfig.key === 'mathPoints' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedStudents.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold italic">No students match current parameters.</td></tr>
                ) : (
                  displayedStudents.map((student) => (
                    <tr key={student.id} onClick={() => router.push(`/teacher/student/${student.id}`)} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                      
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center font-black text-sm text-white shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm group-hover:text-purple-400 transition-colors flex items-center gap-2">
                              {student.name}
                              {student.alerts > 0 && <AlertCircle size={12} className="text-rose-500" />}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[200px]">{student.course}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-blue-400 w-10">{student.courseProgress}%</span>
                          <div className="w-24 h-1.5 bg-[#020617] rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${student.courseProgress}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-black w-10 ${student.attendanceRate < 50 ? 'text-rose-400' : student.attendanceRate < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {student.attendanceRate}%
                          </span>
                          <div className="w-24 h-1.5 bg-[#020617] rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full rounded-full shadow-[0_0_10px_currentColor] ${student.attendanceRate < 50 ? 'bg-rose-500 text-rose-500' : student.attendanceRate < 80 ? 'bg-amber-500 text-amber-500' : 'bg-emerald-500 text-emerald-500'}`} style={{ width: `${student.attendanceRate}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-black tracking-widest">
                          {student.xp.toLocaleString()} XP
                        </span>
                      </td>

                      <td className="px-8 py-5 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5 text-sm font-black text-amber-400">
                          {student.mathPoints.toLocaleString()} <span className="text-[10px] text-amber-500/50 uppercase tracking-widest">Pts</span>
                        </span>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center shrink-0">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Showing {displayedStudents.length} Students</p>
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Activity size={12}/> Live Telemetry Sync</p>
          </div>

        </div>

      </div>
    </div>
  );
}