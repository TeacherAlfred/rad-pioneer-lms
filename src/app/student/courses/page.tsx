"use client";

import { useEffect, useState } from "react";
import { 
  ChevronLeft, Loader2, Zap, Target, BookOpen, 
  ArrowRight, ShieldCheck, Cpu, Code2 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";

// Helper to determine the coding engine from the template type
const getEngineTag = (templateType: string) => {
  if (!templateType) return "MakeCode"; // Default assumption for legacy courses
  if (templateType.includes("makecode")) return "MakeCode";
  if (templateType.includes("python")) return "Python";
  if (templateType.includes("scratch")) return "Scratch";
  if (templateType.includes("java")) return "Java";
  return "Coding Course";
};

export default function CoursesHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCoursesHub() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setUserProfile(profile);

        // 1. Fetch all active enrollments for this student
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id, status, courses(*)')
          .eq('student_id', localUser.id)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: false });

        if (!enrollments || enrollments.length === 0) {
          setEnrolledCourses([]);
          setLoading(false);
          return;
        }

        const courseIds = enrollments.map(e => e.course_id);

        // 2. Fetch all modules and missions for these courses to calculate totals
        const { data: allModules } = await supabase
          .from('modules')
          .select('id, course_id, missions(id)')
          .in('course_id', courseIds);

        // 3. Fetch student's completed tech archives and quiz attempts to calculate progress and XP
        const [archiveRes, quizRes] = await Promise.all([
          supabase.from('tech_archive').select('mission_id, xp_earned, type').eq('student_id', localUser.id).eq('status', 'completed'),
          supabase.from('quiz_attempts').select('module_id, score, passed').eq('student_id', localUser.id).eq('passed', true)
        ]);

        const techArchive = archiveRes.data || [];
        const quizAttempts = quizRes.data || [];

        // 4. Calculate Stats per Course
        const completedMissionIds = new Set(techArchive.map(t => t.mission_id));
        const passedModuleIds = new Set(quizAttempts.map(q => q.module_id));

        const processedCourses = enrollments.map((enrollment) => {
          const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
          if (!course) return null;

          const courseModules = (allModules || []).filter(m => m.course_id === course.id);
          
          let totalMissions = 0;
          let completedMissions = 0;
          
          courseModules.forEach(mod => {
            // Count Quizzes as a mission
            totalMissions++; 
            if (passedModuleIds.has(mod.id)) completedMissions++;

            // Count actual missions
            (mod.missions || []).forEach((mission: any) => {
              totalMissions++;
              if (completedMissionIds.has(mission.id)) completedMissions++;
            });
          });

          // Calculate Course Specific XP
          const courseMissionIds = new Set(courseModules.flatMap(mod => (mod.missions || []).map((m: any) => m.id)));
          let courseXp = 0;
          
          techArchive.forEach(archive => {
            if (courseMissionIds.has(archive.mission_id) || (course.template_type === 'makecode_sandbox' && archive.type === 'custom_logic')) {
              courseXp += (archive.xp_earned || 0);
            }
          });

          const progressPercent = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;

          return {
            ...course,
            stats: {
              totalMissions,
              completedMissions,
              progressPercent,
              courseXp
            }
          };
        }).filter(Boolean);

        setEnrolledCourses(processedCourses);

      } catch (err) {
        console.error("Failed to load courses hub:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCoursesHub();
  }, [router]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <DashboardClientWrapper initialStats={{ xp: userProfile?.xp || 0, level: 1, currentLevel: { name: "Technician", floor: 0 }, nextLevel: { xpRequired: 1000 }}}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617] pb-24">
        
        {/* Background Ambience */}
        <div className="absolute top-0 left-0 w-full h-96 bg-blue-900/10 blur-[120px] pointer-events-none rounded-full transform -translate-y-1/2" />
        
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 relative z-10">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
            <div className="flex items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
              <Link href="/student/dashboard" className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl shrink-0 mt-1 md:mt-0">
                <ChevronLeft size={18} className="md:w-5 md:h-5" />
              </Link>
              <div className="flex-1">
                <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 mb-0.5 md:mb-1">Course Library</p>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words">
                  Your Courses
                </h1>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Global XP</p>
                 <p className="text-2xl font-black italic text-white">{userProfile?.xp || 0}</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                 <Target size={20} />
               </div>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            <AnimatePresence>
              {enrolledCourses.length === 0 ? (
                <div className="col-span-full py-20 text-center border border-white/5 bg-white/[0.02] rounded-[32px]">
                  <BookOpen size={48} className="text-slate-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-black uppercase italic text-slate-300">No Enrolled Courses</h3>
                  <p className="text-slate-400 mt-2 text-sm">You are not currently enrolled in any active courses.</p>
                </div>
              ) : (
                enrolledCourses.map((course, idx) => {
                  const isSandbox = course.template_type === 'makecode_sandbox';
                  const engineName = getEngineTag(course.template_type);

                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={course.id} 
                      className="group flex flex-col bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden hover:border-blue-500/50 transition-all shadow-xl hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] relative"
                    >
                      {/* Top Accent Gradient */}
                      <div className={`h-2 w-full ${isSandbox ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />
                      
                      <div className="p-6 md:p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${isSandbox ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                            {isSandbox ? <Cpu size={24} /> : <Code2 size={24} />}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${isSandbox ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                            {engineName}
                          </span>
                        </div>

                        <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-tight mb-3 text-white">
                          {course.title}
                        </h2>
                        <p className="text-sm text-slate-400 line-clamp-2 mb-8 flex-1">
                          {course.description || "Course curriculum loaded and ready."}
                        </p>

                        <div className="space-y-4 mb-8 bg-black/40 p-5 rounded-2xl border border-white/5">
                          {/* Stat Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lessons Done</p>
                              <p className="text-lg font-black text-white">{course.stats.completedMissions} <span className="text-sm text-slate-500">/ {course.stats.totalMissions}</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Course XP</p>
                              <p className="text-lg font-black text-yellow-500 flex items-center gap-1">
                                {course.stats.courseXp} <Zap size={14} className="fill-yellow-500 -mt-0.5" />
                              </p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                              <span className="text-slate-400">Completion</span>
                              <span className={isSandbox ? 'text-emerald-400' : 'text-blue-400'}>{course.stats.progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${course.stats.progressPercent}%` }}
                                transition={{ duration: 1 }}
                                className={`h-full ${isSandbox ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Route to the New Course Landing Page */}
                        <Link 
                          href={`/student/course/${course.id}`}
                          className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[11px] transition-all group/btn ${isSandbox ? 'bg-emerald-600 hover:bg-emerald-500 text-black' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                          Enter Course 
                          <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </section>

        </div>
      </main>
      <div className="hidden lg:block">
        <ProfileSidebar />
      </div>
    </DashboardClientWrapper>
  );
}