"use client";

import { useEffect, useState } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { 
  Play, Rocket, UserCheck, Loader2, Wifi, 
  Target, Trophy, Map
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMission, setActiveMission] = useState<any>(null);
  const [courseTitle, setCourseTitle] = useState("Game Creator Bootcamp");
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    async function initializeDashboard() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) {
          setUserProfile(profile);
          const milestoneKey = `celebrated_engineer_${profile.id}`;
          if (localStorage.getItem(milestoneKey)) {
            setHasCelebrated(true);
          }
        }
        
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('course_id, courses(title)')
          .eq('student_id', localUser.id)
          .maybeSingle();
        
        if (enrollment) {
          const relatedCourse = enrollment.courses as any;
          if (Array.isArray(relatedCourse) && relatedCourse.length > 0) {
            setCourseTitle(relatedCourse[0].title);
          } else if (relatedCourse?.title) {
            setCourseTitle(relatedCourse.title);
          }

          // FIX: Corrected query to fetch ALL missions for the course, pulling the tech_archive for the user
          const { data: allMissions } = await supabase
            .from('missions')
            .select(`
              *,
              modules!inner(course_id),
              tech_archive(id, student_id)
            `)
            .eq('modules.course_id', enrollment.course_id)
            .order('order_index', { ascending: true });

          // FIX: Find the first mission where this specific student does NOT have a tech_archive entry
          const current = allMissions?.find(m => {
             const hasCompleted = m.tech_archive?.some((archive: any) => archive.student_id === localUser.id);
             return !hasCompleted;
          }) || allMissions?.[0]; // Fallback to first if all completed

          setActiveMission(current);
        }
      } catch (err) { 
        console.error("DASHBOARD_INIT_ERROR:", err); 
      } finally { 
        setLoading(false); 
      }
    }
    initializeDashboard();
  }, [router]);

  useEffect(() => {
    if (!userProfile?.id) return;
    if (userProfile.xp >= 1000 && !hasCelebrated) {
      confetti({
        particleCount: 150, spread: 70, origin: { y: 0.6 },
        colors: ['#4ade80', '#60a5fa', '#ffffff']
      });
      setHasCelebrated(true);
      localStorage.setItem(`celebrated_engineer_${userProfile.id}`, "true");
    }
  }, [userProfile, hasCelebrated]);

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
      accentColor: isEngineer ? "#4ade80" : "#5574a9",
      floor: isEngineer ? 1000 : 0
    },
    nextLevel: {
      name: isEngineer ? "Senior Engineer" : "Engineer",
      xpRequired: isEngineer ? 2500 : 1000
    }
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
                Hello, <span className="text-rad-blue">{userProfile?.display_name || "Pioneer"}</span>
              </h1>
              <div className="flex items-center gap-2 pt-2 text-left">
                <Target size={16} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Current Course: <span className="text-white italic">{courseTitle}</span>
                </span>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase">Total_Power</p>
                  <p className="text-2xl font-black text-white italic leading-none">{currentXP} <span className="text-xs text-rad-blue ml-1 uppercase">XP</span></p>
               </div>
               <div className="w-12 h-12 rounded-2xl bg-rad-blue/20 flex items-center justify-center text-rad-blue border border-rad-blue/20">
                 <Trophy size={24} />
               </div>
            </div>
          </header>

          <section className="bg-gradient-to-br from-[#1e293b] to-[#020617] p-10 rounded-[48px] border border-white/10 relative overflow-hidden shadow-2xl text-left">
            <Rocket className="absolute -right-8 -bottom-8 size-48 text-white/5 -rotate-12 pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <PioneerXPBar 
                xp={currentXP} 
                rankName={stats.currentLevel.name} 
                floor={stats.currentLevel.floor} 
                ceiling={stats.nextLevel.xpRequired} 
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Active_Mission_Uplink</h3>
              <Link href="/student/courses" className="flex items-center gap-2 text-rad-blue text-[10px] font-black uppercase tracking-widest hover:underline transition-all">
                <Map size={14} /> View Roadmap
              </Link>
            </div>

            {activeMission ? (
              <div className="group relative p-[1px] rounded-[56px] bg-gradient-to-r from-rad-teal to-rad-blue shadow-2xl">
                <div className="bg-[#020617] rounded-[55px] p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="space-y-6 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-white/5 text-white border-white/10 italic">
                        {courseTitle}
                      </span>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <Wifi size={10} className="text-green-400 animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-green-400">Sync_Active</span>
                      </div>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-[0.85]">
                      {activeMission.title}
                    </h2>
                  </div>
                  <Link 
                    href={`/student/lesson/${activeMission.id}`} 
                    className="w-28 h-28 rounded-full bg-white text-slate-950 flex items-center justify-center transition-all shadow-lg hover:scale-110 shrink-0"
                  >
                    <Play fill="currentColor" size={40} className="ml-1" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-16 border-2 border-dashed border-white/5 rounded-[56px] text-center opacity-30 italic uppercase text-[10px] font-black tracking-widest">
                Uplink Offline: Sector 100% Secured
              </div>
            )}
          </section>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}