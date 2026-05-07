"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, Award, Loader2 } from "lucide-react";

interface AcademicRecordProps {
  studentId: string;
  enrollments: any[];
  role: "teacher" | "admin";
}

export default function AcademicRecord({ studentId, enrollments, role }: AcademicRecordProps) {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Safe Tailwind variables (prevents Tree-Shaking issues)
  const accentText = role === 'admin' ? 'text-blue-500' : 'text-purple-500';
  const borderHover = role === 'admin' ? 'hover:border-blue-500/30' : 'hover:border-purple-500/30';
  const textHover = role === 'admin' ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400';
  const gradientBar = role === 'admin' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'bg-gradient-to-r from-purple-600 to-blue-500';

  useEffect(() => {
    async function fetchProgress() {
      if (!enrollments || enrollments.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = enrollments.map(e => e.course_id);

      try {
        // 1. Fetch all modules for these enrolled courses
        const { data: modules } = await supabase
          .from('modules')
          .select('id, course_id')
          .in('course_id', courseIds);

        // 2. Fetch passed quizzes for this student (how a module is marked "complete")
        const { data: passedQuizzes } = await supabase
          .from('quiz_attempts')
          .select('module_id')
          .eq('student_id', studentId)
          .eq('passed', true);

        const passedModuleIds = new Set((passedQuizzes || []).map(q => q.module_id));
        const newProgressMap: Record<string, number> = {};

        // 3. Calculate percentage per course mathematically
        courseIds.forEach(cId => {
          const courseModules = (modules || []).filter(m => m.course_id === cId);
          const total = courseModules.length;
          const completed = courseModules.filter(m => passedModuleIds.has(m.id)).length;
          
          newProgressMap[cId] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });

        setProgressMap(newProgressMap);
      } catch (error) {
        console.error("Error fetching academic progress:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [studentId, enrollments]);

  return (
    <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden">
      <BookOpen className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 pointer-events-none" />
      <div className="relative z-10">
        <h2 className="text-xl font-black uppercase italic tracking-widest mb-6 flex items-center gap-2 text-white">
          <Award className={accentText} /> Academic Record
        </h2>
        
        <div className="space-y-4">
          {enrollments.length === 0 ? (
             <div className="p-6 text-center border border-dashed border-white/10 rounded-3xl text-slate-500 text-sm font-bold italic">
               No active course enrollments found.
             </div>
          ) : (
            enrollments.map(enr => {
              const course = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
              if (!course) return null;
              
              // Handle Sandboxes (which have no linear modules)
              const isSandbox = course.template_type === 'makecode_sandbox';
              const progress = isSandbox ? 100 : (progressMap[enr.course_id] || 0); 
              
              return (
                <div key={enr.course_id} className={`bg-[#020617] border border-white/5 p-6 rounded-[24px] transition-colors group ${borderHover}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${enr.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {enr.status}
                      </span>
                      <h3 className={`text-lg font-black text-white mt-3 leading-tight transition-colors ${textHover}`}>
                        {course.title}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-6">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>{isSandbox ? 'Hardware Open Lab' : 'Course Progress'}</span>
                      {loading && !isSandbox ? (
                        <Loader2 size={12} className="animate-spin text-slate-500" />
                      ) : (
                        <span className="text-white">{isSandbox ? 'Active' : `${progress}%`}</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${gradientBar}`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}