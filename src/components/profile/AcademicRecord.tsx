"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, PauseCircle, PlayCircle, XCircle, Plus, Loader2, CheckCircle2, ChevronDown, GraduationCap, X, Award, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AcademicRecordProps {
  studentId: string;
  enrollments: any[];
  role: "teacher" | "admin";
}

export default function AcademicRecord({ studentId, enrollments: initialEnrollments, role }: AcademicRecordProps) {
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isProcessing, setIsProcessing] = useState<string | boolean>(false);

  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Safe Tailwind variables based on role
  const accentText = role === 'admin' ? 'text-blue-500' : 'text-purple-500';
  const borderHover = role === 'admin' ? 'hover:border-blue-500/30' : 'hover:border-purple-500/30';
  const textHover = role === 'admin' ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400';
  const gradientBar = role === 'admin' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'bg-gradient-to-r from-purple-600 to-blue-500';

  // Make sure internal state updates if parent props change
  useEffect(() => {
    setEnrollments(initialEnrollments);
  }, [initialEnrollments]);

  // Fetch available courses that the student isn't already enrolled in
  useEffect(() => {
    async function fetchAvailableCourses() {
      const { data } = await supabase.from('courses').select('id, title, status').eq('status', 'active');
      if (data) {
        const enrolledIds = enrollments.map(e => e.course_id);
        setAvailableCourses(data.filter(c => !enrolledIds.includes(c.id)));
      }
    }
    if (isAddModalOpen) fetchAvailableCourses();
  }, [isAddModalOpen, enrollments]);

  // Calculate Mathematical Progress Based on Modules and Quizzes
  useEffect(() => {
    async function fetchProgress() {
      if (!enrollments || enrollments.length === 0) {
        setLoadingProgress(false);
        return;
      }

      const courseIds = enrollments.map(e => e.course_id);

      try {
        const { data: modules } = await supabase
          .from('modules')
          .select('id, course_id')
          .in('course_id', courseIds);

        const { data: passedQuizzes } = await supabase
          .from('quiz_attempts')
          .select('module_id')
          .eq('student_id', studentId)
          .eq('passed', true);

        const passedModuleIds = new Set((passedQuizzes || []).map(q => q.module_id));
        const newProgressMap: Record<string, number> = {};

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
        setLoadingProgress(false);
      }
    }

    fetchProgress();
  }, [studentId, enrollments]);

  // --- ACTIONS ---

  const handleUpdateStatus = async (enrollmentId: string, newStatus: string) => {
    setIsProcessing(enrollmentId);
    try {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: newStatus })
        .eq('id', enrollmentId);

      if (error) throw error;

      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e));
    } catch (err: any) {
      alert(`Failed to update enrollment: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- HARD UNENROLL ACTION ---
  const handleUnenroll = async (enrollmentId: string) => {
    if (!window.confirm("Are you sure you want to permanently unenroll this student? This will delete the enrollment record completely.")) return;
    
    setIsProcessing(enrollmentId);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;

      // Optimistic update: Remove from UI
      setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
    } catch (err: any) {
      alert(`Failed to unenroll: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCourse = async () => {
    if (!selectedCourseId) return;
    setIsProcessing(true);
    
    try {
      const newEnrollment = {
        student_id: studentId,
        course_id: selectedCourseId,
        status: 'active',
        progress: 0,
        enrolled_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('enrollments').insert([newEnrollment]).select('*, courses(*)').single();

      if (error) throw error;

      setEnrollments([data, ...enrollments]);
      setIsAddModalOpen(false);
      setSelectedCourseId("");
    } catch (err: any) {
      alert(`Failed to enroll: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'paused': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden">
      <BookOpen className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6 relative z-10">
        <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-3 text-white">
          <Award className={accentText} /> Academic Record
        </h2>
        
        {role === 'admin' && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
          >
            <Plus size={14}/> Enroll Course
          </button>
        )}
      </div>

      <div className="space-y-4 relative z-10">
        {enrollments.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-white/10 rounded-3xl text-slate-500 text-sm font-bold italic">
            No active course enrollments found.
          </div>
        ) : (
          enrollments.map((enr) => {
            const course = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
            if (!course) return null;
            
            // Handle Sandboxes (which have no linear modules)
            const isSandbox = course.template_type === 'makecode_sandbox';
            const calculatedProgress = isSandbox ? 100 : (progressMap[enr.course_id] || 0); 
            
            return (
              <div key={enr.id} className={`bg-[#020617] border border-white/5 p-6 rounded-[24px] flex flex-col md:flex-row md:items-start justify-between gap-6 transition-colors group ${borderHover}`}>
                
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${getStatusColor(enr.status)}`}>
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
                      {loadingProgress && !isSandbox ? (
                        <Loader2 size={12} className="animate-spin text-slate-500" />
                      ) : (
                        <span className="text-white">{isSandbox ? 'Active' : `${calculatedProgress}%`}</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${gradientBar}`} 
                        style={{ width: `${calculatedProgress}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* ACTION CONTROLS */}
                {role === 'admin' && (
                  <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {isProcessing === enr.id ? (
                      <div className="px-4 py-2"><Loader2 size={16} className="text-blue-500 animate-spin" /></div>
                    ) : (
                      <>
                        {enr.status === 'active' ? (
                          <button 
                            onClick={() => handleUpdateStatus(enr.id, 'paused')}
                            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Pause Enrollment"
                          >
                            <PauseCircle size={16}/>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateStatus(enr.id, 'active')}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Resume/Activate Enrollment"
                          >
                            <PlayCircle size={16}/>
                          </button>
                        )}
                        
                        {enr.status !== 'cancelled' && (
                          <button 
                            onClick={() => {
                              if(window.confirm('Set enrollment status to cancelled?')) {
                                handleUpdateStatus(enr.id, 'cancelled');
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Set Status to Cancelled"
                          >
                            <XCircle size={16}/>
                          </button>
                        )}

                        {/* NEW: HARD UNENROLL (DELETE) */}
                        <button 
                          onClick={() => handleUnenroll(enr.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border-l border-white/5 ml-1 pl-3"
                          title="Permanently Unenroll (Delete from DB)"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ENROLLMENT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{opacity: 0, scale: 0.95}} 
              animate={{opacity: 1, scale: 1}} 
              exit={{opacity: 0, scale: 0.95}} 
              className="bg-[#0f172a] border border-white/10 rounded-[40px] p-8 max-w-md w-full shadow-2xl flex flex-col"
            >
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-white">
                   <Plus className="text-blue-500" size={24} /> New Enrollment
                 </h2>
                 <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
               </div>
               
               <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">Select Course</label>
                 <div className="relative">
                   <select 
                     value={selectedCourseId} 
                     onChange={e => setSelectedCourseId(e.target.value)} 
                     className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                   >
                     <option value="" disabled>Choose a program...</option>
                     {availableCourses.length === 0 && <option value="" disabled>No available courses found.</option>}
                     {availableCourses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                     ))}
                   </select>
                   <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                 </div>
               </div>

               <div className="flex items-center gap-3 mt-8 pt-6 border-t border-white/5">
                 <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                   Cancel
                 </button>
                 <button onClick={handleAddCourse} disabled={isProcessing === true || !selectedCourseId} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                   {isProcessing === true ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Confirm
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}