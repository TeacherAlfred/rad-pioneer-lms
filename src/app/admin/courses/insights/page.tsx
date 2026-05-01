"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Loader2, Trophy, Clock, 
  Activity, Zap, BookOpen, Users, TrendingUp,
  Award, Target, BarChart3, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function GlobalInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [platformTotals, setTotalStats] = useState({
    totalXp: 0,
    activeEnrollments: 0,
    recentActions: 0,
    topCourse: ""
  });

  useEffect(() => {
    fetchGlobalIntel();
  }, []);

  async function fetchGlobalIntel() {
    setLoading(true);
    try {
      // 1. Fetch all core data in parallel
      // We pull course_xp_earned directly from enrollments now (automated by your DB trigger)
      const [coursesRes, enrollmentRes, recentActivityRes] = await Promise.all([
        supabase.from('courses').select('id, title, is_published'),
        supabase.from('enrollments').select('course_id, student_id, course_xp_earned'),
        supabase.from('tech_archive')
          .select('id, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const courses = coursesRes.data || [];
      const enrollments = enrollmentRes.data || [];
      const recentActions = recentActivityRes.data || [];

      // 2. Process metrics per course
      const stats = courses.map(course => {
        const courseEnrollments = enrollments.filter(e => e.course_id === course.id);
        
        // Sum the pre-calculated column from the enrollment table
        const totalCourseXp = courseEnrollments.reduce((acc, curr) => acc + (curr.course_xp_earned || 0), 0);

        return {
          ...course,
          studentCount: courseEnrollments.length,
          totalXp: totalCourseXp,
        };
      });

      // Sort by most popular (student count)
      const sortedStats = [...stats].sort((a, b) => b.studentCount - a.studentCount);

      setCourseStats(sortedStats);
      setTotalStats({
        totalXp: enrollments.reduce((acc, curr) => acc + (curr.course_xp_earned || 0), 0),
        activeEnrollments: enrollments.length,
        recentActions: recentActions.length,
        topCourse: sortedStats[0]?.title || "N/A"
      });

    } catch (err) {
      console.error("GLOBAL_INTEL_ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Synchronizing_Global_Intel...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-6">
            <Link href="/admin/courses" className="group flex items-center gap-2 w-fit bg-white/5 border border-white/10 hover:border-purple-500/50 px-5 py-2.5 rounded-2xl transition-all">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Back to Archives</span>
            </Link>
            
            <div className="space-y-2">
              <h1 className="text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                Command_<span className="text-purple-500">Insights</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Operational Cross-Sector Matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 px-6 py-4 rounded-3xl backdrop-blur-md">
            <ShieldCheck className="text-purple-400" size={20} />
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Data Integrity</p>
              <p className="text-xs font-bold text-purple-300 uppercase">Live Sync Active</p>
            </div>
          </div>
        </header>

        {/* --- MACRO STATS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatCard label="Total Platform Yield" value={platformTotals.totalXp.toLocaleString()} icon={Zap} color="text-yellow-500" suffix="XP" />
           <StatCard label="Active Enrollments" value={platformTotals.activeEnrollments} icon={Users} color="text-blue-500" suffix="Pioneers" />
           <StatCard label="7-Day Activity" value={platformTotals.recentActions} icon={Activity} color="text-emerald-500" suffix="Missions" />
           <StatCard label="High-Traffic Sector" value={platformTotals.topCourse} icon={Target} color="text-purple-500" isText />
        </div>

        {/* --- PERFORMANCE TABLE --- */}
        <div className="bg-[#0f172a]/60 border border-white/10 rounded-[48px] overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-purple-500" size={24} />
              <h3 className="text-xl font-black italic uppercase text-white">Sector_Performance_Grid</h3>
            </div>
            <div className="hidden md:block text-[9px] font-black text-slate-600 uppercase tracking-widest border border-white/5 px-4 py-2 rounded-full">
              Real-time update stream enabled
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                  <th className="px-10 py-6">Sector Identification</th>
                  <th className="px-10 py-6 text-center">Status</th>
                  <th className="px-10 py-6 text-center">Pioneers</th>
                  <th className="px-10 py-6 text-center">Pre-Calc XP Yield</th>
                  <th className="px-10 py-6 text-right">Intelligence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {courseStats.map((course) => (
                  <tr key={course.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-8">
                      <p className="text-lg font-black italic text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight leading-none">{course.title}</p>
                      <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-widest">ID: {course.id.split('-')[0]}...</p>
                    </td>
                    <td className="px-10 py-8 text-center">
                       <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          course.is_published ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                       }`}>
                         {course.is_published ? 'Uplink Active' : 'Standby'}
                       </span>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <span className="font-black text-xl text-blue-400 italic leading-none">{course.studentCount}</span>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-xl text-yellow-500 italic leading-none">{course.totalXp.toLocaleString()}</span>
                        <span className="text-[8px] text-slate-600 font-black uppercase mt-1">Summed from enrollments</span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <Link 
                        href={`/admin/courses/${course.id}/insights`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-purple-600 hover:border-purple-500 text-slate-400 hover:text-white transition-all group/btn"
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest">Sector Intel</span>
                        <TrendingUp size={14} className="group-hover/btn:scale-110 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, suffix, isText = false }: any) {
  return (
    <div className="bg-[#1e293b]/40 border border-white/5 rounded-[32px] p-8 relative overflow-hidden group hover:border-white/10 transition-all backdrop-blur-md">
      <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
        <Icon size={120} />
      </div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`font-black italic text-white tracking-tighter leading-none ${isText ? 'text-2xl uppercase' : 'text-4xl'}`}>
          {value}
        </p>
        {!isText && <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest">{suffix}</span>}
      </div>
    </div>
  );
}