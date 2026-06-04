"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, Play, CheckCircle2, Timer, 
  ShieldAlert, Zap, Zap as ZapIcon, Flag, Milestone,
  CloudLightning, Lightbulb, Bot, Radio,
  Code2, Settings, Microchip, Volume2, Gamepad2, Radar,
  Terminal, Server, BatteryCharging, LogOut,
  User,
  Star
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- TYPES ---
interface MissionData {
  id: string;
  title: string;
  lore_text: string;
  order_index: number;
  xp_reward: number;
  unlock_date: string | null;
  isCompleted: boolean;
  isLocked: boolean;
  unlockDateObj: Date | null;
}

// --- HELPERS ---
const getMissionIcon = (title: string, lore: string) => {
  const text = (title + " " + lore).toLowerCase();
  if (/(alarm|intruder|security|protect|safe)/.test(text)) return ShieldAlert;
  if (/(storm|weather|rain|wind|window)/.test(text)) return CloudLightning;
  if (/(light|led|glow|flash)/.test(text)) return Lightbulb;
  if (/(sound|music|buzzer|audio)/.test(text)) return Volume2;
  if (/(motor|spin|wheel|mechanic)/.test(text)) return Settings;
  if (/(sensor|detect|distance|radar)/.test(text)) return Radar;
  if (/(radio|transmit|signal|wifi)/.test(text)) return Radio;
  if (/(game|play|score|arcade)/.test(text)) return Gamepad2;
  if (/(code|logic|loop|program)/.test(text)) return Code2;
  if (/(robot|bot|machine)/.test(text)) return Bot;
  return Microchip; 
};

// Generates a mock "hardware part" based on the mission context for the inventory
const getHardwareReward = (title: string) => {
  const text = title.toLowerCase();
  if (text.includes("alarm")) return "Motion Sensor";
  if (text.includes("light") || text.includes("loadshedding")) return "Relay Switch";
  if (text.includes("window") || text.includes("storm")) return "Servo Motor";
  if (text.includes("radio")) return "Radio Transmitter";
  return "Logic Chip";
};

export default function PioneerTrialHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [userName, setUserName] = useState("Pioneer");
  
  // Kinetic UI State
  const [bootingMission, setBootingMission] = useState<string | null>(null);
  const [bootText, setBootText] = useState("");

  useEffect(() => {
    async function initHQ() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const user = JSON.parse(sessionData);
      setUserName(user.display_name || "Pioneer");

      try {
        const { data: enrollments, error: enrollError } = await supabase
          .from('enrollments').select('course_id').eq('student_id', user.id).eq('status', 'active');
          
        if (enrollError) throw enrollError;
        const courseIds = enrollments?.map(e => e.course_id) || [];

        let fetchedMissions: any[] = [];
        if (courseIds.length > 0) {
          const { data: modules } = await supabase.from('modules').select('id').in('course_id', courseIds);
          const moduleIds = modules?.map(m => m.id) || [];

          if (moduleIds.length > 0) {
            const { data: missionData } = await supabase
              .from('missions')
              .select('id, title, lore_text, order_index, unlock_date, xp_reward')
              .in('module_id', moduleIds)
              .order('order_index', { ascending: true });
            fetchedMissions = missionData || [];
          }
        }

        const { data: archive } = await supabase.from('tech_archive').select('mission_id').eq('student_id', user.id);
        const completedSet = new Set(archive?.map(a => a.mission_id) || []);
        const now = new Date();
        let xpAccumulated = 0;

        const processedMissions = fetchedMissions.map(m => {
          const unlockDateObj = m.unlock_date ? new Date(m.unlock_date) : null;
          const isLocked = unlockDateObj ? unlockDateObj > now : false;
          const isCompleted = completedSet.has(m.id);
          
          if (isCompleted) xpAccumulated += (m.xp_reward || 0);

          return { ...m, isCompleted, isLocked, unlockDateObj, xp_reward: m.xp_reward || 0 };
        });

        setMissions(processedMissions);
        setTotalXP(xpAccumulated);
      } catch (err) {
        console.error("HQ Error:", err);
      } finally {
        setLoading(false);
      }
    }
    initHQ();
  }, [router]);

  // --- ACTIONS ---
  const handleBootSequence = (id: string) => {
    setBootingMission(id);
    
    // Fun loading text effect for kids
    let iteration = 0;
    const interval = setInterval(() => {
      setBootText(iteration % 2 === 0 ? "LOADING MISSION..." : "GETTING THINGS READY...");
      iteration++;
      if (iteration > 10) {
        clearInterval(interval);
        setBootText("READY. STARTING MISSION NOW.");
        setTimeout(() => router.push(`/student/lesson/${id}`), 500);
      }
    }, 250);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("pioneer_session");
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Zap className="animate-pulse text-blue-500 w-12 h-12" /></div>;

  // --- NARRATIVE LOGIC ---
  const firstLockedIndex = missions.findIndex(m => m.isLocked);
  const activeMission = missions.find(m => !m.isCompleted && !m.isLocked);
  const isLoadsheddingActive = activeMission?.title.toLowerCase().includes("loadshedding");

  const rankProgress = Math.min((totalXP / 1000) * 100, 100);
  const currentRank = totalXP >= 1000 ? "Level 2: Builder" : "Level 1: Beginner";

  return (
    <main className={`min-h-screen font-sans overflow-hidden flex flex-col relative transition-colors duration-1000 ${isLoadsheddingActive ? 'bg-black' : 'bg-[#020617]'}`}>
      
      {/* ==========================================
          SIGN OUT BUTTON
          ========================================== */}
      <button
        onClick={handleSignOut}
        className="fixed top-6 right-6 z-50 p-3 md:px-5 md:py-3 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 rounded-full md:rounded-2xl transition-all flex items-center justify-center gap-2 group backdrop-blur-md shadow-lg"
        title="Sign Out"
      >
        <span className="hidden md:block text-[10px] font-black uppercase tracking-widest">Sign Out</span>
        <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* ==========================================
          KINETIC BOOT OVERLAY 
          ========================================== */}
      <AnimatePresence>
        {bootingMission && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center p-8"
          >
            <Terminal size={48} className="text-emerald-500 mb-6 animate-pulse" />
            <p className="text-emerald-500 font-mono text-xl md:text-3xl text-center tracking-widest">{bootText}</p>
            <div className="w-64 h-1 bg-emerald-900 mt-8 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1 }} className="h-full bg-emerald-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] blur-[150px] rounded-full pointer-events-none transition-all duration-1000 ${
        isLoadsheddingActive ? 'bg-slate-900/20 animate-pulse opacity-50' : 'bg-blue-600/10'
      }`} />

      {/* --- WELCOME SIDEBAR (LEFT) --- */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4">
        <div className="bg-[#0f172a]/80 backdrop-blur-md border border-white/5 p-6 rounded-3xl w-56 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4 border border-blue-500/30">
            <User className="text-blue-400" size={24} />
          </div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Welcome Back</h4>
          <h2 className="text-xl font-black text-white mb-6 uppercase italic tracking-tighter">{userName}</h2>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">XP Rank</p>
            <p className="text-xs font-black text-blue-400 uppercase italic tracking-widest flex items-center gap-2">
              <Star size={12} className="fill-blue-400" /> {currentRank}
            </p>
          </div>
        </div>
      </div>
      
      {/* ==========================================
          META-PROGRESSION RIG (Inventory Sidebar)
          ========================================== */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4 mt-6">
        <div className="bg-[#0f172a]/80 backdrop-blur-md border border-white/5 p-4 rounded-3xl w-48 shadow-2xl">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Server size={12}/> My Parts
          </h4>
          <div className="space-y-3">
            {missions.map((m) => {
              if (!m.isCompleted) return null;
              return (
                <div key={m.id} className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg"><Microchip size={12} className="text-blue-400"/></div>
                  <span className="text-[10px] font-black text-blue-300 uppercase leading-tight">{getHardwareReward(m.title)}</span>
                </div>
              );
            })}
            {missions.filter(m => m.isCompleted).length === 0 && (
              <p className="text-[10px] text-slate-600 italic font-bold">Your bag is empty. Complete missions to collect parts!</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative p-4 md:p-8 pb-32 z-10">
        <div className="max-w-4xl mx-auto relative space-y-8 md:space-y-16 mt-8 md:mt-12">
          
          {/* ==========================================
              RANK HEADER
              ========================================== */}
          <div className="text-center space-y-6 mb-16">
            <h1 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg leading-none mt-10 md:mt-0">
              My <span className="text-blue-500">Adventure</span>
            </h1>
            
            {/* Dynamic Progress Bar */}
            <div className="max-w-md mx-auto bg-[#0f172a] border border-white/10 p-4 rounded-2xl shadow-xl">
              <div className="flex justify-between items-end mb-2">
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">My Rank</p>
                  <p className="text-sm font-black text-white italic tracking-widest">{currentRank}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-1 justify-end"><BatteryCharging size={10}/> Total XP</p>
                  <p className="text-sm font-black text-blue-400">{totalXP} XP</p>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: `${rankProgress}%` }} transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" 
                />
              </div>
            </div>
          </div>

          {/* ==========================================
              THE CIRCUIT BOARD MAP
              ========================================== */}
          {missions.length > 0 && (
            <div className="relative py-10">
              
              {/* Central Circuit Trace */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1.5 bg-slate-800 -translate-x-1/2 rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] z-0">
                 {/* Energy Pulse travelling to the active mission */}
                 <motion.div 
                   animate={{ y: ["0%", "100%"], opacity: [0, 1, 0] }}
                   transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                   className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent blur-[2px]"
                 />
              </div>

              {missions.map((mission, index) => {
                const showSeparator = mission.isLocked && index === firstLockedIndex;
                const isEven = index % 2 === 0;
                
                const isNextActive = !mission.isCompleted && !mission.isLocked;
                const nodeColor = mission.isCompleted 
                  ? 'bg-emerald-500 border-emerald-900 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)]' 
                  : isNextActive 
                    ? 'bg-blue-500 border-blue-900 text-white shadow-[0_0_40px_rgba(59,130,246,0.6)] animate-pulse'
                    : 'bg-slate-800 border-slate-900 text-slate-500';

                const BackgroundIcon = getMissionIcon(mission.title, mission.lore_text || "");

                return (
                  <div key={mission.id} className="relative z-10">
                    
                    {showSeparator && (
                      <div className="relative flex justify-start md:justify-center mb-16 pl-16 md:pl-0">
                         <div className="bg-[#0f172a] border-2 border-dashed border-slate-700 px-6 py-2.5 rounded-full flex items-center gap-3 shadow-xl">
                            <Lock size={14} className="text-slate-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Up</span>
                         </div>
                      </div>
                    )}

                    <div className={`relative flex flex-col md:flex-row items-center mb-16 last:mb-0 group ${isEven ? '' : 'md:flex-row-reverse'}`}>
                      
                      {/* Node & Circuit Branch */}
                      <div className={`absolute left-8 md:left-1/2 -translate-x-1/2 w-12 h-12 md:w-16 md:h-16 rounded-full border-[4px] md:border-8 flex items-center justify-center z-20 transition-all duration-500 ${nodeColor}`}>
                        {mission.isCompleted ? <CheckCircle2 size={24} /> : isNextActive ? <Play size={24} className="ml-1" fill="currentColor"/> : <Lock size={20} />}
                      </div>

                      {/* Branch Line connecting Node to Card (Desktop only) */}
                      <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 w-[calc(50%-4rem)] h-1.5 bg-slate-800 z-0 ${isEven ? 'right-0' : 'left-0'}`}>
                         {isNextActive && <div className="w-full h-full bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse"/>}
                      </div>

                      <div className="hidden md:block md:w-1/2" />

                      {/* Card Container */}
                      <div className={`w-full pl-24 md:pl-0 md:w-1/2 ${isEven ? 'md:pr-12 lg:pr-20' : 'md:pl-12 lg:pl-20'}`}>
                        
                        <motion.div 
                          whileHover={isNextActive ? { scale: 1.03, x: isEven ? -10 : 10 } : {}}
                          onClick={() => !mission.isCompleted && !mission.isLocked && handleBootSequence(mission.id)}
                          className={`relative rounded-[32px] border-[2px] md:border-[3px] overflow-hidden transition-all duration-300 group/card backdrop-blur-sm ${
                            mission.isCompleted 
                              ? 'bg-emerald-950/10 border-emerald-500/30'
                              : isNextActive
                                ? 'bg-[#0f172a]/80 border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)] cursor-pointer'
                                : 'bg-[#020617]/50 border-rose-500/20 opacity-70 hover:border-rose-500/50 hover:opacity-100'
                          }`}
                        >
                          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none z-0" />
                          
                          {/* Faint Background Icon */}
                          <div className={`absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none transition-transform duration-1000 z-0 ${mission.isLocked ? 'text-rose-500 group-hover/card:text-rose-400' : 'text-white group-hover/card:scale-110 group-hover/card:-rotate-6'}`}>
                             <BackgroundIcon size={240} />
                          </div>

                          <div className="p-6 md:p-8 relative z-10 flex flex-col gap-4">
                            
                            {/* NEW: EMPHASIZED MISSION HEADER */}
                            <div className="flex justify-between items-start mb-2">
                              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border ${
                                mission.isCompleted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                                isNextActive ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]' :
                                'bg-slate-900/80 text-slate-500 border-slate-700'
                              }`}>
                                <Milestone size={14} className={isNextActive ? "text-white" : ""}/> 
                                Mission {String(mission.order_index).padStart(2, '0')}
                              </div>

                              {/* XP Display */}
                              <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                               mission.isCompleted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                               isNextActive ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                               'bg-slate-800 text-slate-500 border-slate-700'
                              }`}>
                                <ZapIcon size={12} /> {mission.xp_reward} XP
                              </div>
                            </div>

                            <div>
                              <h3 className={`text-xl md:text-3xl font-black uppercase italic tracking-tight leading-none ${mission.isLocked ? 'text-rose-500/70' : 'text-white'}`}>
                                {mission.isLocked ? "LOCKED MISSION" : mission.title}
                              </h3>
                            </div>

                            <p className={`text-xs md:text-sm font-medium leading-relaxed mt-2 ${mission.isLocked ? 'text-slate-600' : 'text-slate-300'}`}>
                              {mission.isLocked ? "LOCKED. Finish earlier missions or wait for the unlock date to see what's next!" : mission.lore_text}
                            </p>

                            {/* Status Footer */}
                            <div className="pt-6 mt-2 border-t border-white/5 flex items-center justify-between">
                              {mission.isCompleted ? (
                                <span className="text-emerald-400 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                                  <CheckCircle2 size={14}/> Mission Complete
                                </span>
                              ) : isNextActive ? (
                                <button onClick={(e) => { e.stopPropagation(); handleBootSequence(mission.id); }} className="text-blue-400 font-black uppercase text-[11px] tracking-widest flex items-center gap-2 group-hover/card:text-blue-300 transition-colors">
                                  CLICK TO START LESSON <Play size={12} fill="currentColor"/>
                                </button>
                              ) : (
                                <span className="text-yellow-500 font-black uppercase text-[9px] tracking-widest flex items-center gap-1.5 transition-colors">
                                  <Timer size={14}/> 
                                  Unlocks {mission.unlockDateObj ? mission.unlockDateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Soon'}
                                </span>
                              )}
                            </div>

                          </div>
                        </motion.div>
                      </div>

                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>
    </main>
  );
}