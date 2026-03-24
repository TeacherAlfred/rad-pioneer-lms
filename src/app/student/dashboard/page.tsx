"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, 
  Map, Zap, BarChart3, ShieldCheck, Sparkles, Trophy
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ActiveTaskData {
  type: 'mission' | 'checkpoint';
  id: string;
  title: string;
  moduleTitle: string;
  moduleDesc: string;
  moduleVideo: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<ActiveTaskData | null>(null);
  const [courseTitle, setCourseTitle] = useState("Game Creator Bootcamp");
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    async function initializeDashboard() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      const userId = localUser.id;

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profile) setUserProfile(profile);
        
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('course_id, active_task, courses(title)')
          .eq('student_id', userId)
          .maybeSingle();
        
        if (enrollment) {
          const rawCourse = enrollment.courses as any;
          setCourseTitle(Array.isArray(rawCourse) ? rawCourse[0]?.title : rawCourse?.title || "Course");

          // 1. Instant UI Load from Cache
          if (enrollment.active_task) {
            setActiveTask(enrollment.active_task as ActiveTaskData);
          }

          // 2. Background Sync: Pass the current pointer so we can compare and auto-heal
          await autoSyncPointer(userId, enrollment.course_id, enrollment.active_task);
        }
      } catch (err) {
        console.error("DASHBOARD_INIT_ERROR:", err);
      } finally {
        setLoading(false);
      }
    }

    async function autoSyncPointer(userId: string, courseId: string, currentPointer: any) {
      const { data: techArchive } = await supabase.from('tech_archive').select('mission_id').eq('student_id', userId);
      const completedMissionIds = (techArchive || []).map(t => t.mission_id);

      const { data: quizAttempts } = await supabase.from('quiz_attempts').select('module_id').eq('student_id', userId).eq('passed', true);
      const passedModuleIds = (quizAttempts || []).map(q => q.module_id);

      const { data: modules } = await supabase
        .from('modules')
        .select('*, missions(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      let calculatedTask: ActiveTaskData | null = null;
      let totalMissions = 0;
      let totalCompleted = 0;

      if (modules) {
        for (const mod of modules) {
          const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);

          for (const m of sortedMissions) {
            totalMissions++;
            const isDone = completedMissionIds.includes(m.id);
            if (isDone) totalCompleted++;

            if (!isDone && !calculatedTask) {
              calculatedTask = {
                type: 'mission',
                id: m.id,
                title: m.title,
                moduleTitle: mod.title,
                // Fallback to module description/video if mission doesn't have one
                moduleDesc: m.description || mod.description, 
                moduleVideo: m.video_url || mod.video_url 
              };
            }
          }

          if (!passedModuleIds.includes(mod.id) && !calculatedTask) {
            calculatedTask = {
              type: 'checkpoint',
              id: mod.id,
              title: 'Knowledge Uplink',
              moduleTitle: mod.title,
              moduleDesc: mod.description || "Master the concepts of this sector to advance!",
              moduleVideo: mod.video_url
            };
          }
        }
      }

      setCompletionStats({ completed: totalCompleted, total: totalMissions });

      // 3. Auto-Heal the Cache: If the calculated task is different from the cached pointer (e.g. you added a video URL), update it!
      if (calculatedTask) {
        setActiveTask(calculatedTask); // Force UI to use freshest data
        
        if (!currentPointer || JSON.stringify(currentPointer) !== JSON.stringify(calculatedTask)) {
          await supabase.from('enrollments').update({ active_task: calculatedTask }).eq('student_id', userId);
        }
      } else if (!calculatedTask && currentPointer) {
         // If course is completed but pointer is still active, clear it
         setActiveTask(null);
         await supabase.from('enrollments').update({ active_task: null }).eq('student_id', userId);
      }
    }

    initializeDashboard();
  }, [router]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = { xp: currentXP, level: isEngineer ? 2 : 1, currentLevel: { name: isEngineer ? "Engineer" : "Technician", floor: isEngineer ? 1000 : 0 }, nextLevel: { xpRequired: 2500 } };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617] pb-20">
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-10 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
                Hello, <span className="text-blue-400">{userProfile?.display_name || "Pioneer"}</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 flex items-center gap-4 shadow-xl">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total_XP</p>
                  <p className="text-2xl font-black text-white italic leading-none">{currentXP}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                  <Zap size={20} fill="currentColor" />
                </div>
              </div>
              <div className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 flex items-center gap-4 shadow-xl">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Uplinks</p>
                  <p className="text-2xl font-black text-white italic leading-none">{completionStats.completed}/{completionStats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <BarChart3 size={20} />
                </div>
              </div>
            </div>
          </header>

          <section className="bg-gradient-to-br from-[#1e293b] to-[#020617] p-10 rounded-[48px] border border-white/10 relative overflow-hidden shadow-2xl">
            <Rocket className="absolute -right-8 -bottom-8 size-48 text-white/5 -rotate-12 pointer-events-none" />
            <div className="relative z-10 space-y-6"><PioneerXPBar xp={currentXP} rankName={stats.currentLevel.name} floor={stats.currentLevel.floor} ceiling={stats.nextLevel.xpRequired} /></div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {activeTask?.type === 'checkpoint' ? 'System_Checkpoint_Pending' : 'Active_Mission_Uplink'}
              </h3>
              <Link href="/student/courses" className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:underline transition-all">
                <Map size={14} /> View Roadmap
              </Link>
            </div>

            {activeTask ? (
              <div className="relative rounded-[56px] overflow-hidden border border-white/10 bg-[#020617] shadow-2xl">
                <div className="relative h-64 md:h-80 w-full overflow-hidden bg-slate-900">
                  {activeTask.moduleVideo ? (
                    <video 
                      key={activeTask.moduleVideo} 
                      src={activeTask.moduleVideo}
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover opacity-60" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-600/20 to-purple-600/20">
                       <Rocket size={64} className="text-white/10 animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
                  <div className="absolute top-6 left-8">
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black/60 text-white border-white/20 backdrop-blur-md italic">
                      {activeTask.type === 'checkpoint' ? 'Final Verification' : activeTask.moduleTitle}
                    </span>
                  </div>
                </div>

                <div className="px-8 md:px-14 pb-12 -mt-16 relative z-10">
                  <div className="flex flex-col md:flex-row items-end justify-between gap-8">
                    <div className="space-y-4 text-left max-w-xl">
                      <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-[0.85]">
                        {activeTask.title}
                      </h2>
                      <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-5 rounded-3xl">
                        <Sparkles className="text-blue-400 shrink-0 mt-1" size={20} />
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">
                          {activeTask.moduleDesc || "Your next challenge awaits! Complete this mission to unlock new creator powers."}
                        </p>
                      </div>
                    </div>

                    <Link 
                      href={activeTask.type === 'checkpoint' ? `/student/quiz/${activeTask.id}` : `/student/lesson/${activeTask.id}`} 
                      className={`w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl hover:scale-110 shrink-0 group ${
                        activeTask.type === 'checkpoint' ? 'bg-yellow-500 text-black' : 'bg-white text-slate-950'
                      }`}
                    >
                      {activeTask.type === 'checkpoint' ? <ShieldCheck size={48} /> : <Play fill="currentColor" size={44} className="ml-1" />}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[56px] text-center space-y-4">
                 <Trophy size={48} className="text-yellow-500 mx-auto" />
                 <h2 className="text-3xl font-black uppercase italic">Course Completed!</h2>
                 <p className="text-slate-400">You've cleared every sector. Return to the Roadmap to review your archive.</p>
              </div>
            )}
          </section>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}