"use client";

import { useEffect, useState } from "react";
import { 
  ChevronLeft, Lock, CheckCircle2, Loader2, 
  Zap, BarChart3, ChevronDown, ChevronUp, ShieldCheck, 
  ShieldAlert, Clock, CalendarClock, Cpu, LayoutDashboard
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { calculateDiminishingXP, calculateEventXp } from "@/lib/xp-engine";

// Safely parse JSON configs from Supabase
const safeParse = (data: any) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try { return JSON.parse(data); } catch(e) { return {}; }
};

// Format dates beautifully
const formatUnlockDate = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to determine the coding engine tag
const getEngineTag = (templateType: string) => {
  if (!templateType || templateType === 'linear_standard') return "Linear Sector";
  if (templateType.includes("makecode")) return "MakeCode Sandbox";
  if (templateType.includes("python")) return "Python Sandbox";
  if (templateType.includes("scratch")) return "Scratch Sandbox";
  return "Interactive Sandbox";
};

export default function CourseLandingPage() {
  const router = useRouter();
  const { id: courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [sandboxState, setSandboxState] = useState<any>({ used_inputs: [], used_outputs: [] });
  const [courseHardware, setCourseHardware] = useState<any[]>([]);
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0, courseXp: 0, nextRewardXP: 0 });

  useEffect(() => {
    async function fetchCourseDetails() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setUserProfile(profile);

        // 1. Fetch Enrollment & Course Data
        const { data: enrollmentData, error: enrollError } = await supabase
          .from('enrollments')
          .select('course_id, sandbox_state, status, courses(*)')
          .eq('student_id', localUser.id)
          .eq('course_id', courseId)
          .eq('status', 'active')
          .single();

        if (enrollError || !enrollmentData) {
          router.push('/student/courses');
          return;
        }

        const rawCourse = enrollmentData.courses as any;
        const currentCourse = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
        setCourseData(currentCourse);
        setSandboxState(enrollmentData.sandbox_state || { used_inputs: [], used_outputs: [] });

        // 2. Fetch Modules & Missions (for Linear courses)
        const { data: modulesData } = await supabase
          .from('modules')
          .select(`*, missions (*)`)
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        // 2.5 Fetch Course-Specific Hardware Components (for Sandbox courses)
        let fetchedHardware: any[] = [];
        if (currentCourse.template_type === 'makecode_sandbox') {
          const { data: hardwareData } = await supabase
            .from('course_components')
            .select(`
              unlock_tier,
              is_required,
              platform_components (*)
            `)
            .eq('course_id', courseId);
            
          if (hardwareData) {
            fetchedHardware = hardwareData.map(h => ({
              ...h.platform_components,
              unlock_tier: h.unlock_tier,
              is_required: h.is_required
            }));
          }
        }

        // 3. Fetch Progress (Tech Archive & Quizzes)
        const [archiveRes, quizRes] = await Promise.all([
          supabase.from('tech_archive').select('mission_id, xp_earned, type').eq('student_id', localUser.id).eq('status', 'completed'),
          supabase.from('quiz_attempts').select('module_id, passed, score').eq('student_id', localUser.id)
        ]);

        const techArchive = archiveRes.data || [];
        const completedMissions = new Set(techArchive.map(t => t.mission_id));
        
        const quizMap = (quizRes.data || []).reduce((acc: any, curr: any) => {
          if (!acc[curr.module_id]) acc[curr.module_id] = { passed: false, bestScore: 0 };
          if (curr.passed) acc[curr.module_id].passed = true;
          if (curr.score > acc[curr.module_id].bestScore) acc[curr.module_id].bestScore = curr.score;
          return acc;
        }, {});

        // 4. Calculate Linear Progression & Stats
        let globalPrevComplete = true; 
        let activeModId: string | null = null;
        let totalMissionsCount = 0;
        let totalCompletedCount = 0;
        let totalCourseXp = 0;

        const processedModules = (modulesData || []).map((mod: any) => {
          const moduleQuiz = quizMap[mod.id] || { passed: false, bestScore: 0 };
          const isQuizPassed = moduleQuiz.passed;
          const bestScore = moduleQuiz.bestScore;

          const modConfig = safeParse(mod.module_config);
          const modIsPublished = mod.is_published !== false && modConfig.is_published !== false && (mod.status || '').toLowerCase() !== 'draft';
          const modUnlockDate = mod.unlock_date ? new Date(mod.unlock_date) : null;
          const modIsDateLocked = modUnlockDate && modUnlockDate > new Date();

          let modBaseStatus = 'locked';
          if (isQuizPassed) modBaseStatus = 'completed';
          else if (!modIsPublished) modBaseStatus = 'standby';
          else if (modIsDateLocked) modBaseStatus = 'scheduled';
          else if (globalPrevComplete) modBaseStatus = 'unlocked';
          
          if (modBaseStatus === 'unlocked' && !activeModId) activeModId = mod.id;

          const sortedMissions = (mod.missions || []).sort((a: any, b: any) => a.order_index - b.order_index);
          let prevMissionInModuleDone = true; 

          const processedMissions = sortedMissions.map((m: any) => {
            totalMissionsCount++;
            const isDone = completedMissions.has(m.id);
            if (isDone) totalCompletedCount++;
            
            const mConfig = safeParse(m.mission_config);
            const missionIsPublished = m.is_published !== false && mConfig.is_published !== false && (m.status || '').toLowerCase() !== 'draft';
            const mUnlockDate = m.unlock_date ? new Date(m.unlock_date) : null;
            const mIsDateLocked = mUnlockDate && mUnlockDate > new Date();
            
            const isEffectivelyPublished = modIsPublished && missionIsPublished;
            const isEffectivelyDateLocked = modIsDateLocked || mIsDateLocked;
            
            let status = 'locked';
            if (isDone) status = 'completed';
            else if (!isEffectivelyPublished) status = 'standby'; 
            else if (isEffectivelyDateLocked) {
              status = 'scheduled';
              m.displayDate = modIsDateLocked ? mod.unlock_date : m.unlock_date; 
            } else if (globalPrevComplete && prevMissionInModuleDone) {
              status = 'unlocked';
            }

            prevMissionInModuleDone = isDone;
            return { ...m, status };
          });

          const allMissionsDone = processedMissions.length > 0 && processedMissions.every((m: any) => m.status === 'completed');
          
          let quizStatus = 'locked';
          if (isQuizPassed) quizStatus = 'completed';
          else if (!modIsPublished) quizStatus = 'standby';
          else if (modIsDateLocked) quizStatus = 'scheduled';
          else if (allMissionsDone) quizStatus = 'unlocked';

          globalPrevComplete = isQuizPassed; 

          return { 
            ...mod,
            modBaseStatus,
            missions: processedMissions, 
            quiz: { status: quizStatus, passed: isQuizPassed, bestScore } 
          };
        });

        // 5. Calculate XP based on template type & Find Next Reward
        const courseMissionIds = new Set((modulesData || []).flatMap(mod => (mod.missions || []).map((m: any) => m.id)));
        let customLogicCount = 0;
        let nextRewardXP = 0;
        let foundNextMission = false;

        techArchive.forEach(archive => {
          if (courseMissionIds.has(archive.mission_id) || (currentCourse.template_type === 'makecode_sandbox' && archive.type === 'custom_logic')) {
            totalCourseXp += (archive.xp_earned || 0);
          }
          if (currentCourse.template_type === 'makecode_sandbox' && archive.type === 'custom_logic') {
            customLogicCount++;
          }
        });

        if (currentCourse.template_type === 'makecode_sandbox') {
          // AWAIT the diminishing XP calculation
          nextRewardXP = await calculateDiminishingXP(150, customLogicCount);
        } else {
          // Use 'for...of' loops so we can safely use 'await'
          for (const mod of processedModules) {
            for (const m of mod.missions) {
              if (m.status === 'unlocked' && !foundNextMission) {
                // AWAIT the global multiplier check for standard missions
                nextRewardXP = await calculateEventXp(m.xp_reward || 50); 
                foundNextMission = true;
                break; // Stop looking once we found the next mission
              }
            }
            if (foundNextMission) break; // Break out of the outer loop too
          }
        }

        setModules(processedModules);
        setCourseHardware(fetchedHardware);
        setCompletionStats({ completed: totalCompletedCount, total: totalMissionsCount, courseXp: totalCourseXp, nextRewardXP });
        setOpenModuleId(activeModId || (processedModules.length > 0 ? processedModules[0].id : null));

      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    }
    fetchCourseDetails();
  }, [router, courseId]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: isEngineer ? "Engineer" : "Technician",
      floor: isEngineer ? 1000 : 0
    },
    nextLevel: { xpRequired: isEngineer ? 2500 : 1000 }
  };

  const isSandbox = courseData?.template_type === 'makecode_sandbox';

  // --- HARDWARE UNLOCK LOGIC ---
  const functionalHardware = courseHardware.filter(h => h.category === 'input' || h.category === 'output');
  const beginnerHardware = functionalHardware.filter(h => h.unlock_tier === 'beginner');
  
  // They are considered to have mastered the core if they have used EVERY beginner component at least once.
  const isBeginnerMastered = beginnerHardware.length > 0 && beginnerHardware.every(h => 
    (sandboxState?.used_inputs || []).includes(h.id) || 
    (sandboxState?.used_outputs || []).includes(h.id)
  );

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 relative overflow-hidden text-left bg-[#020617] pb-24">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-12 relative z-10">
          
          {/* PREMIUM COMMAND BANNER */}
          <header className="relative bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 mb-8 shadow-2xl flex flex-col xl:flex-row gap-6 xl:gap-8 justify-between items-start xl:items-center overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] pointer-events-none" />

            <div className="flex flex-col gap-6 w-full xl:w-auto z-10">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/student/courses" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all shadow-sm">
                  <ChevronLeft size={14} /> Course Library
                </Link>
                <Link href="/student/dashboard" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all shadow-sm">
                  <LayoutDashboard size={14} /> Dashboard
                </Link>
              </div>

              <div>
                <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">
                  {getEngineTag(courseData?.template_type)}
                </p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words">
                  {courseData?.title || 'Unknown Course'}
                </h1>
              </div>
            </div>

            <div className="w-full xl:w-[420px] bg-black/40 border border-white/5 rounded-2xl p-5 md:p-6 z-10 flex flex-col gap-4 shadow-inner">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Rank: <span className="text-white ml-1">{stats.currentLevel.name}</span>
                  </span>
                </div>
                <div className="text-right flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/20">
                  <Zap size={12} className="fill-yellow-500 text-yellow-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                    +{completionStats.nextRewardXP} XP Next
                  </span>
                </div>
              </div>

              <div className="relative h-4 md:h-5 w-full bg-[#020617] rounded-full overflow-hidden border border-white/10 shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, ((stats.xp - stats.currentLevel.floor) / (stats.nextLevel.xpRequired - stats.currentLevel.floor)) * 100))}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:15px_15px] animate-[shimmer_1s_linear_infinite]" />
                </motion.div>
              </div>

              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="text-slate-300">{stats.xp} Total XP</span>
                <span>Next Rank: {stats.nextLevel.xpRequired} XP</span>
              </div>
            </div>
          </header>

          <section className="space-y-4 md:space-y-6">
            {isSandbox ? (
              
              /* =========================================
                 SANDBOX COURSE PORTAL & LOADOUT GRID
                 ========================================= */
              <div className="relative bg-[#020617] border border-blue-500/20 rounded-[32px] md:rounded-[56px] text-center shadow-[0_0_50px_rgba(59,130,246,0.1)] overflow-hidden flex flex-col items-center justify-center mt-6 group">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.05)_50%,transparent_75%)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/80 z-0" />

                <div className="relative z-10 space-y-6 flex flex-col items-center p-6 md:p-14 max-w-4xl mx-auto w-full">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform duration-500">
                    <Cpu className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 inline-block mb-2">
                      Open Environment
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter italic text-white drop-shadow-lg leading-none">
                      Hardware Sandbox
                    </h2>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed mx-auto max-w-lg">
                      {courseData?.description || "Select inputs, actuators, and synthesize your own custom automated systems."}
                    </p>
                  </div>

                  {/* VISUAL HARDWARE KIT LOADOUT */}
                  <div className="w-full mt-8 mb-4 text-left bg-black/40 border border-white/5 p-5 md:p-8 rounded-[24px] md:rounded-[32px] shadow-inner">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <Cpu size={16} className="text-blue-500" /> Hardware Loadout
                      </h4>
                      <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Mastered: <span className="text-white">{(sandboxState.used_inputs || []).length + (sandboxState.used_outputs || []).length} / {functionalHardware.length}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                      {courseHardware.map(h => {
                        const isReference = h.category === 'reference';
                        const isMastered = (sandboxState?.used_inputs || []).includes(h.id) || (sandboxState?.used_outputs || []).includes(h.id);
                        const isAdvanced = h.unlock_tier === 'advanced';
                        const isLocked = isAdvanced && !isBeginnerMastered;

                        return (
                          <div key={h.id} className={`relative p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all ${isMastered ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : isLocked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}>
                            
                            <div className="absolute top-2 right-2">
                              {isMastered ? <CheckCircle2 size={14} className="text-emerald-400" /> : isLocked ? <Lock size={12} className="text-slate-500" /> : null}
                            </div>
                            
                            <div className="w-12 h-12 rounded-xl bg-black/50 flex items-center justify-center overflow-hidden mb-1 border border-white/5 p-1">
                              {h.image_url ? <img src={h.image_url} alt={h.name} className={`w-full h-full object-contain ${isLocked ? 'grayscale opacity-50' : 'opacity-90'}`} /> : <Cpu size={20} className="text-slate-500" />}
                            </div>

                            <p className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest line-clamp-2 leading-tight">
                              {h.name}
                            </p>

                            {/* LOCK SCREEN OVERLAY */}
                            {isLocked && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/80 rounded-2xl backdrop-blur-[2px] p-3 border border-amber-500/20">
                                <Lock size={16} className="text-amber-500 mb-2" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/90 leading-tight drop-shadow-md">Complete Core First</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button 
                    onClick={() => router.push(`/student/makecode-sb/${courseData.id}`)}
                    className="w-full sm:w-auto px-10 py-5 md:px-14 md:py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs md:text-sm transition-all hover:scale-105 hover:-translate-y-1 active:scale-95 shadow-[0_0_30px_rgba(59,130,246,0.4)] flex items-center justify-center gap-3 mt-4"
                  >
                    <Zap size={18} className="animate-pulse" /> Initialize Logic Lab
                  </button>
                </div>
              </div>

            ) : modules.length === 0 ? (
              
              /* =========================================
                 AWAITING CLEARANCE (Empty Standard Course)
                 ========================================= */
              <div className="relative bg-[#020617] border border-white/5 rounded-[32px] md:rounded-[56px] text-center shadow-2xl overflow-hidden group min-h-[400px] md:min-h-[500px] flex flex-col items-center justify-center mt-6 md:mt-12">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-1000">
                  <span className="text-[5rem] sm:text-[6rem] md:text-[10rem] font-black text-white whitespace-nowrap -rotate-12 italic tracking-tighter">
                    CLASSIFIED
                  </span>
                </div>

                <div className="relative z-10 space-y-4 md:space-y-6 flex flex-col items-center backdrop-blur-md bg-[#020617]/70 p-6 md:p-14 rounded-[24px] md:rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-[90%] md:max-w-lg mx-auto">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-[#0f172a] border border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                     <div className="absolute inset-0 border border-fuchsia-500/30 rounded-2xl md:rounded-3xl animate-ping opacity-20" />
                     <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-fuchsia-400" />
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-white drop-shadow-lg leading-none">Awaiting Clearance</h2>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-sm mx-auto">
                      Your training roadmap is currently classified. Sectors and missions will populate here once Command authorizes your curriculum.
                    </p>
                  </div>
                </div>
              </div>
              
            ) : (
              /* =========================================
                 STANDARD LINEAR MODULE ROADMAP
                 ========================================= */
              modules.map((mod) => {
                const isOpen = openModuleId === mod.id;
                const isClickable = mod.modBaseStatus === 'unlocked' || mod.modBaseStatus === 'completed';

                return (
                  <div key={mod.id} className={`bg-white/[0.02] border border-white/5 rounded-[28px] md:rounded-[40px] overflow-hidden transition-all shadow-2xl ${isClickable ? '' : 'opacity-80'}`}>
                    
                    <button 
                      onClick={() => isClickable && setOpenModuleId(isOpen ? null : mod.id)} 
                      className={`w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-8 transition-all text-left ${isClickable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <div className="flex items-start md:items-center gap-3 md:gap-4 w-full md:w-auto">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black border shrink-0 text-sm md:text-base ${mod.modBaseStatus === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : isClickable ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                          M{mod.order_index}
                        </div>
                        <div className="mt-[-2px] md:mt-0 flex-1">
                          <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tighter text-white leading-tight drop-shadow-md pr-2">{mod.title}</h2>
                          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-snug">{mod.description}</p>
                        </div>
                      </div>

                      <div className="shrink-0 mt-1 md:mt-0 self-end md:self-auto">
                        {isClickable ? (
                          isOpen ? <ChevronUp className="text-slate-500 w-5 h-5 md:w-6 md:h-6" /> : <ChevronDown className="text-slate-500 w-5 h-5 md:w-6 md:h-6" />
                        ) : mod.modBaseStatus === 'scheduled' ? (
                          <div className="flex items-center gap-1.5 md:gap-2 text-amber-500 bg-amber-500/10 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-amber-500/20">
                            <CalendarClock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Unlocks {formatUnlockDate(mod.unlock_date)}</span>
                          </div>
                        ) : mod.modBaseStatus === 'standby' ? (
                          <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
                            <Clock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Standby</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Encrypted</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {isOpen && isClickable && (
                      <div className="p-4 sm:p-5 md:p-8 pt-0 grid gap-3 md:gap-4 pl-10 md:pl-20 border-l-2 border-blue-500/20 ml-10 md:ml-14 mb-5 md:mb-8">
                        {mod.missions.map((m: any) => (
                          <div key={m.id} className={`relative p-5 md:p-6 rounded-[20px] md:rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 ${m.status === 'locked' || m.status === 'standby' || m.status === 'scheduled' ? 'bg-white/5 border-white/5 opacity-60' : m.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]'}`}>
                            <div className={`absolute -left-[31px] md:-left-[71px] w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center border-[3px] md:border-4 border-[#020617] ${m.status === 'completed' ? 'bg-green-400' : m.status === 'locked' || m.status === 'standby' || m.status === 'scheduled' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                              {m.status === 'completed' ? <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#020617]" /> : m.status === 'locked' ? <Lock className="w-2 h-2 md:w-2.5 md:h-2.5 text-[#020617]" /> : m.status === 'standby' || m.status === 'scheduled' ? <Clock className="w-2 h-2 md:w-2.5 md:h-2.5 text-[#020617]" /> : <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#020617] rounded-full" />}
                            </div>
                            <div className="space-y-1 flex-1">
                              <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ${m.status === 'completed' ? 'text-green-400' : m.status === 'standby' ? 'text-slate-400' : m.status === 'scheduled' ? 'text-amber-500' : m.status === 'locked' ? 'text-slate-500' : 'text-blue-400'}`}>Milestone_{m.order_index}</span>
                              <h3 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter leading-tight drop-shadow-md pr-2">{m.title}</h3>
                            </div>
                            
                            {m.status === 'scheduled' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <CalendarClock size={14} /> Unlocks {formatUnlockDate(m.displayDate)}
                              </button>
                            ) : m.status === 'standby' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <Clock size={14} /> Standby
                              </button>
                            ) : m.status === 'locked' ? (
                              <button disabled className="w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                                <Lock size={14} /> Encrypted
                              </button>
                            ) : (
                              <button 
                                onClick={() => router.push(`/student/lesson/${m.id}`)} 
                                className={`w-full md:w-auto px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest transition-all shrink-0 flex justify-center items-center ${m.status === 'completed' ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}
                              >
                                {m.status === 'completed' ? 'Review Archive' : 'Enter Mission'}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* MODULE QUIZ / CHECKPOINT */}
                        <div className={`relative p-5 md:p-8 mt-4 md:mt-6 rounded-[24px] md:rounded-[32px] border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 ${mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'bg-white/5 border-white/5 opacity-50' : mod.quiz?.status === 'completed' ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]'}`}>
                          <div className={`absolute -left-[33px] md:-left-[71px] w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center border-[3px] md:border-4 border-[#020617] ${mod.quiz?.status === 'completed' ? 'bg-yellow-400' : mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'bg-slate-700' : 'bg-blue-400 animate-pulse'}`}>
                            {mod.quiz?.status === 'completed' ? <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#020617]" /> : mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? <Clock className="w-3 h-3 md:w-3 md:h-3 text-[#020617]" /> : mod.quiz?.status === 'locked' ? <Lock className="w-3 h-3 md:w-3 md:h-3 text-[#020617]" /> : <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#020617]" />}
                          </div>
                          <div className="space-y-1">
                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ${mod.quiz?.status === 'completed' ? 'text-yellow-400' : mod.quiz?.status === 'locked' || mod.quiz?.status === 'standby' || mod.quiz?.status === 'scheduled' ? 'text-slate-400' : 'text-blue-400'}`}>Knowledge_Uplink</span>
                            <h3 className="text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter leading-tight drop-shadow-md">Level-Up Checkpoint</h3>
                            {mod.quiz?.status === 'completed' && <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-yellow-400 mt-2">Best Score: {mod.quiz?.bestScore}%</p>}
                          </div>
                          
                          {mod.quiz?.status === 'scheduled' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-6 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <CalendarClock size={14} /> Unlocks {formatUnlockDate(mod.unlock_date)}
                            </button>
                          ) : mod.quiz?.status === 'standby' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <Clock size={14} /> Standby
                            </button>
                          ) : mod.quiz?.status === 'locked' ? (
                            <button disabled className="w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed flex justify-center items-center gap-2 transition-all shrink-0">
                              <Lock size={14} /> Encrypted
                            </button>
                          ) : (
                            <button onClick={() => window.location.href = `/student/quiz/${mod.id}`} className={`w-full md:w-auto px-5 py-3.5 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest transition-all shrink-0 flex justify-center items-center ${mod.quiz?.status === 'completed' ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/30' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>
                              {mod.quiz?.status === 'completed' ? 'Review Checkpoint' : 'Start Checkpoint'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
      <div className="hidden lg:block">
        <ProfileSidebar />
      </div>
    </DashboardClientWrapper>
  );
}