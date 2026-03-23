"use client";

import { useEffect, useState } from "react";
import { 
  ChevronLeft, Lock, CheckCircle2, Play, 
  Target, Zap, BarChart3, ArrowRight, Loader2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";

export default function CourseRoadmapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    async function fetchRoadmap() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        // 1. Fresh Profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setUserProfile(profile);

        // 2. Get Enrollment
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('*, courses:course_id(*)')
          .eq('student_id', localUser.id)
          .maybeSingle();

        if (!enrollment) {
          console.error("👻 GHOST_CHECK: No enrollment record found.");
          setLoading(false);
          return;
        }
        setCourseData(enrollment.courses);

        // 3. Get Modules
        const { data: modules } = await supabase
          .from('modules')
          .select('id')
          .eq('course_id', enrollment.course_id);

        const moduleIds = modules?.map(m => m.id) || [];
        console.log("👻 GHOST_CHECK: Module IDs found:", moduleIds);

        if (moduleIds.length > 0) {
          // 4. Get Missions
          const { data: allMissions, error: mError } = await supabase
            .from('missions')
            .select(`
              *,
              tech_archive ( xp_earned, score, student_id )
            `)
            .in('module_id', moduleIds)
            .order('order_index', { ascending: true });

          if (mError) console.error("👻 GHOST_CHECK: DB Mission Error:", mError);
          console.log("👻 GHOST_CHECK: Raw Missions from DB:", allMissions);

          // 5. Process Progress Logic
          let foundCurrent = false;
          const processed = allMissions?.map((m: any) => {
            const submission = m.tech_archive?.find((s: any) => s.student_id === localUser.id);
            const isDone = !!submission;
            const isCurrent = !isDone && !foundCurrent;
            if (isCurrent) foundCurrent = true;

            return {
              ...m,
              status: isDone ? 'completed' : isCurrent ? 'current' : 'locked',
              xpEarned: submission?.xp_earned || 0,
              quizScore: submission?.score || 0
            };
          });

          console.log("👻 GHOST_CHECK: Render-ready missions:", processed);
          setMissions(processed || []);
        }
      } catch (err) {
        console.error("ROADMAP_INIT_ERROR:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoadmap();
  }, [router]);

  if (loading) return (
    <div className="h-screen bg-[#020617] flex items-center justify-center">
      <Loader2 className="animate-spin text-rad-blue" size={40} />
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
      accentColor: "#5574a9", 
      xpRequired: 1000
    },
    nextLevel: { name: "Engineer", xpRequired: 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#020617] text-white p-6 md:p-12 text-left">
        <div className="max-w-4xl mx-auto space-y-10 relative z-10">
          
          <header className="space-y-6">
            <Link href="/student/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
              <ChevronLeft size={16} /> Return to Bridge
            </Link>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-2">
                <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
                  Mission <span className="text-rad-blue">Roadmap</span>
                </h1>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">
                  Sector: {courseData?.title || "Assigning..."}
                </p>
              </div>

              <div className="flex gap-3">
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center min-w-[100px]">
                  <Zap size={14} className="text-rad-yellow mx-auto mb-1" />
                  <p className="text-[8px] font-black uppercase text-slate-600">Total XP</p>
                  <p className="text-lg font-black italic">{currentXP}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center min-w-[100px]">
                  <BarChart3 size={14} className="text-rad-blue mx-auto mb-1" />
                  <p className="text-[8px] font-black uppercase text-slate-600">Uplinks</p>
                  <p className="text-lg font-black italic">{missions.filter(m => m.status === 'completed').length}/{missions.length}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="relative space-y-6">
            <div className="absolute left-[39px] top-10 bottom-10 w-1 bg-white/5 rounded-full hidden md:block" />

            {missions.length > 0 ? (
              missions.map((mission, index) => (
                <div key={mission.id} className="relative flex items-start gap-8 group">
                  <div className={`mt-2 w-20 h-20 rounded-[24px] flex items-center justify-center shrink-0 z-10 border-4 transition-all ${
                    mission.status === 'completed' ? 'bg-rad-green/10 border-rad-green text-rad-green shadow-[0_0_20px_rgba(34,197,94,0.2)]' :
                    mission.status === 'current' ? 'bg-rad-blue/20 border-rad-blue text-rad-blue animate-pulse' :
                    'bg-white/5 border-white/10 text-slate-800'
                  }`}>
                    {mission.status === 'completed' ? <CheckCircle2 size={32} /> :
                     mission.status === 'current' ? <Play fill="currentColor" size={32} /> :
                     <Lock size={32} />}
                  </div>

                  <div className={`flex-1 p-8 rounded-[40px] border transition-all ${
                    mission.status === 'locked' ? 'bg-white/2 border-white/5 opacity-40' : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
                  }`}>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Mission {index + 1}</span>
                        <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">{mission.title}</h3>
                        {mission.status === 'completed' && (
                          <p className="text-[9px] font-black uppercase text-rad-green tracking-widest">Archive Secured</p>
                        )}
                      </div>

                      {mission.status !== 'locked' && (
                        <Link 
                          href={`/student/lesson/${mission.id}`}
                          className={`px-8 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all ${
                            mission.status === 'completed' ? 'bg-white/5 text-white' : 'bg-white text-black hover:scale-105'
                          }`}
                        >
                          {mission.status === 'completed' ? 'Review' : 'Enter Mission'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center opacity-30 italic font-black uppercase tracking-widest text-xs border-2 border-dashed border-white/5 rounded-[48px]">
                Uplink Error: No Missions Found in this Sector
              </div>
            )}
          </section>
        </div>
      </main>
      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}