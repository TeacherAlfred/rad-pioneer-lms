"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, Wifi, 
  Target, Trophy, Map, Zap, BarChart3 
} from "lucide-react";
import Link from "next/link"; // Fixed Import
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMission, setActiveMission] = useState<any>(null);
  const [courseTitle, setCourseTitle] = useState("Game Creator Bootcamp");
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    async function initializeDashboard() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setUserProfile(profile);
        
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('course_id, courses(title)')
          .eq('student_id', localUser.id)
          .maybeSingle();
        
        if (enrollment) {
          const rawCourse = enrollment.courses as any;
          const title = Array.isArray(rawCourse) ? rawCourse[0]?.title : rawCourse?.title;
          setCourseTitle(title || "Game Creator Bootcamp");

          const { data: allMissions } = await supabase
            .from('missions')
            .select(`*, modules!inner(course_id), tech_archive(student_id)`)
            .eq('modules.course_id', enrollment.course_id)
            .order('order_index', { ascending: true });

          if (allMissions) {
            const completedCount = allMissions.filter(m => 
              m.tech_archive?.some((a: any) => String(a.student_id).toLowerCase() === String(localUser.id).toLowerCase())
            ).length;
            
            setCompletionStats({ completed: completedCount, total: allMissions.length });

            const current = allMissions.find(m => {
               const archives = m.tech_archive || [];
               return !archives.some((a: any) => String(a.student_id).toLowerCase() === String(localUser.id).toLowerCase());
            }) || allMissions[0];

            setActiveMission(current);
          }
        }
      } catch (err) { 
        console.error("DASHBOARD_INIT_ERROR:", err); 
      } finally { 
        setLoading(false); 
      }
    }
    initializeDashboard();
  }, [router]);

  if (loading) return (
    <div className="h-screen bg-[#020617] flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: isEngineer ? "Engineer" : "Technician",
      code: isEngineer ? "ENG-02" : "TECH-01",
      accentColor: isEngineer ? "#4ade80" : "#60a5fa",
      floor: isEngineer ? 1000 : 0
    },
    nextLevel: { name: "Senior Engineer", xpRequired: 2500 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617]">
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-10 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
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
            <div className="relative z-10 space-y-6">
              <PioneerXPBar xp={currentXP} rankName={stats.currentLevel.name} floor={stats.currentLevel.floor} ceiling={stats.nextLevel.xpRequired} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Active_Mission_Uplink</h3>
              <Link href="/student/courses" className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:underline transition-all">
                <Map size={14} /> View Roadmap
              </Link>
            </div>

            {activeMission && (
              <div className="group relative p-[1px] rounded-[56px] bg-gradient-to-r from-[#45a79a] to-blue-500 shadow-2xl">
                <div className="bg-[#020617] rounded-[55px] p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="space-y-6 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-white/5 text-white border-white/10 italic">{courseTitle}</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-[0.85]">
                      {activeMission.title}
                    </h2>
                  </div>
                  <Link href={`/student/lesson/${activeMission.id}`} className="w-28 h-28 rounded-full bg-white text-slate-950 flex items-center justify-center transition-all shadow-lg hover:scale-110 shrink-0">
                    <Play fill="currentColor" size={40} className="ml-1" />
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}