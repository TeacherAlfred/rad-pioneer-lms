"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Loader2, Users, Trophy, Clock, 
  CheckCircle2, Activity, Calendar, ShieldCheck, Zap
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CourseInsightsPage() {
  const { courseId } = useParams();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalXp: 0, avgProgress: 0 });

  useEffect(() => {
    fetchIntelligence();
  }, [courseId]);

  async function fetchIntelligence() {
    setLoading(true);
    try {
      // 1. Fetch Course Info
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(courseData);

      // 2. Fetch Enrollments with Profile Data
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          status,
          enrolled_at,
          profiles!inner(id, display_name, xp, metadata)
        `)
        .eq('course_id', courseId);

      // 3. Fetch Activity Data (Last activity per student for this course)
      const { data: activityData } = await supabase
        .from('tech_archive')
        .select('student_id, created_at, xp_earned')
        .order('created_at', { ascending: false });

      // 4. Combine Data
      const processedRoster = enrollmentData?.map((en: any) => {
        const studentActivity = activityData?.filter(a => a.student_id === en.profiles.id) || [];
        const lastAction = studentActivity[0]?.created_at || null;
        const courseSpecificXp = studentActivity.reduce((acc, curr) => acc + (curr.xp_earned || 0), 0);

        return {
          id: en.profiles.id,
          name: en.profiles.display_name,
          status: en.status,
          totalProfileXp: en.profiles.xp,
          courseXp: courseSpecificXp,
          lastActive: lastAction,
          tier: en.profiles.metadata?.account_tier || 'Trial'
        };
      }) || [];

      // Sort by Course XP for leaderboard
      setRoster(processedRoster.sort((a, b) => b.courseXp - a.courseXp));
      
      const totalXpEarned = processedRoster.reduce((acc, curr) => acc + curr.courseXp, 0);
      setStats({ totalXp: totalXpEarned, avgProgress: 0 });

    } catch (err) {
      console.error("INTEL_FETCH_ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Compiling_Course_Intel...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <header className="space-y-6">
          <Link href="/admin/courses" className="group flex items-center gap-2 w-fit bg-white/5 border border-white/10 hover:border-purple-500/50 px-5 py-2.5 rounded-2xl transition-all">
            <ArrowLeft size={16} className="text-slate-500 group-hover:text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Back to Archives</span>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-purple-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Sector_Intelligence_Report</p>
              <h1 className="text-5xl font-black uppercase italic tracking-tighter text-white leading-none">{course?.title}</h1>
            </div>
            <div className="flex gap-4">
               <div className="bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 min-w-[140px]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Course XP</p>
                  <p className="text-2xl font-black text-purple-400 italic">{stats.totalXp.toLocaleString()}</p>
               </div>
               <div className="bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 min-w-[140px]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Pioneers</p>
                  <p className="text-2xl font-black text-blue-400 italic">{roster.length}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- LEADERBOARD (Top XP) --- */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#0f172a] border border-white/10 rounded-[40px] p-8 shadow-2xl">
              <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={20} /> Sector_Elites
              </h3>
              <div className="space-y-4">
                {roster.slice(0, 5).map((student, i) => (
                  <div key={student.id} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-lg font-black italic text-slate-600 w-4">#{i+1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{student.name}</p>
                      <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">{student.courseXp} XP EARNED</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-[40px] p-8 text-white relative overflow-hidden group">
               <Activity className="absolute -right-4 -bottom-4 size-32 opacity-20 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
               <h3 className="text-lg font-black uppercase italic mb-2 relative z-10">System Health</h3>
               <p className="text-xs font-medium text-blue-100 leading-relaxed relative z-10">Overall engagement in this sector is up 12% from last cycle. Average Pioneer activity occurs every 2.4 days.</p>
            </div>
          </div>

          {/* --- FULL ROSTER TABLE --- */}
          <div className="lg:col-span-2">
            <div className="bg-[#1e293b]/30 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                  <Users className="text-blue-500" size={20} /> Pioneer_Roster_status
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Pioneer</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5">Course XP</th>
                      <th className="px-8 py-5">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {roster.map((student) => (
                      <tr key={student.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{student.name}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{student.tier} ACCESS</p>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                            student.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-black italic text-purple-400">
                          {student.courseXp}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock size={14} />
                            <span className="text-xs font-medium">
                              {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : 'No Activity'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}