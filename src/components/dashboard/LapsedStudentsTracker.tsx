"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { UserX, AlertCircle, ChevronRight, Loader2, CalendarX2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function LapsedStudentsTracker({ students, viewScope, currentUser, refreshTrigger }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.includes('/admin') ? '/admin/student' : '/teacher/student';

  const [loading, setLoading] = useState(true);
  const [sqlActiveStudentIds, setSqlActiveStudentIds] = useState<Set<string>>(new Set());

  // 1. Calculate "Start of Previous Week" (Saturday)
  const cutoffDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysToSubtract = (now.getDay() + 1) % 7; 
    const currentSat = new Date(now);
    currentSat.setDate(now.getDate() - daysToSubtract);
    const prevSat = new Date(currentSat);
    prevSat.setDate(currentSat.getDate() - 7);
    return prevSat;
  }, []);

  // 2. Fetch students who have SQL lessons scheduled ON or AFTER the cutoff date
  useEffect(() => {
    const fetchActiveStudents = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('lesson_schedule')
          .select('student_id')
          .gte('start_time', cutoffDate.toISOString());

        if (viewScope === 'my_roster' && currentUser) {
          query = query.eq('teacher_id', currentUser.id);
        } else if (viewScope !== 'global') {
          query = query.eq('teacher_id', viewScope);
        }

        const { data, error } = await query;
        if (error) throw error;
        setSqlActiveStudentIds(new Set(data.map((d: any) => d.student_id)));
      } catch (err) {
        console.error("Failed to fetch active students:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveStudents();
  }, [viewScope, currentUser, refreshTrigger, cutoffDate]);

  // 3. Filter lapsed students
  const lapsedStudents = useMemo(() => {
    return students.filter((s: any) => {
      // Check that the student is active and actually enrolled in a course/tier
      const hasCurrentTier = s.status === 'active' && s.course !== 'Unassigned';
      
      // If they have an active tier AND are missing from the SQL schedule, flag them
      return hasCurrentTier && !sqlActiveStudentIds.has(s.id);
    });
  }, [students, sqlActiveStudentIds]);

  return (
    <div className="bg-[#0f172a] rounded-[32px] border border-white/5 shadow-2xl flex flex-col h-[700px] overflow-hidden">
      <div className="p-6 border-b border-rose-500/20 bg-rose-500/5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
            <UserX size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase italic tracking-widest text-white">Lapsed Students</h2>
            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">
              No lessons since {cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        {loading && <Loader2 size={16} className="text-rose-500 animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {lapsedStudents.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
            <CalendarX2 size={40} className="text-slate-500 mb-3" />
            <p className="text-sm font-black text-white italic">Roster is completely up to date!</p>
            <p className="text-xs text-slate-400 mt-1 font-bold">Every student has a recent or upcoming lesson.</p>
          </div>
        ) : (
          lapsedStudents.map((s: any) => (
            <div 
              key={s.id} 
              onClick={() => router.push(`${basePath}/${s.id}`)}
              className="bg-[#020617] border border-white/5 hover:border-rose-500/30 p-4 rounded-2xl flex items-center justify-between group cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center text-xs font-black shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">{s.name}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle size={10} className="text-rose-500/50" /> Action Required
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}