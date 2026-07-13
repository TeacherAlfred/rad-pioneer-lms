import { motion } from "framer-motion";
import { Cpu, Map, Zap, ShieldCheck, ChevronRight, Shield, BatteryCharging, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ActiveCourseCard({ enrollment, progressStats, isPreLaunchLms }: any) {
  const router = useRouter();
  const courseData = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
  
  if (!courseData) return null;
  
  const activeTask = enrollment.active_task;
  
  // Update: Break out the different sandbox types
  const isMakecodeSandbox = courseData?.template_type === 'makecode_sandbox';
  const isVideoHub = courseData?.template_type === 'video_hub_sandbox';
  
  const sandboxState = enrollment.sandbox_state || { used_inputs: [], used_outputs: [] };

  return (
    <div className="relative bg-[#0f172a] border border-blue-500/30 rounded-[32px] md:rounded-[48px] overflow-hidden flex flex-col md:flex-row shadow-[0_0_40px_rgba(59,130,246,0.1)] group">
      {/* LEFT SIDE: COURSE PRECEDENCE */}
      <div className="p-6 md:p-10 md:w-[55%] flex flex-col justify-between relative z-10 border-b md:border-b-0 md:border-r border-white/5 bg-[#020617]/60">
        
        <div className="space-y-6 md:space-y-8 w-full pr-4">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-[0.9] drop-shadow-sm">
              {courseData.title}
            </h2>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-5 md:p-6 space-y-6 shadow-inner">
            {isMakecodeSandbox || isVideoHub ? (
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Cpu size={12} className="text-blue-500" /> Hardware Mastery
                  </span>
                  <span className="text-xs font-black text-blue-400">
                    {sandboxState.used_inputs?.length || 0} Inputs / {sandboxState.used_outputs?.length || 0} Outputs
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 relative opacity-50"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]" />
                  </motion.div>
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-3 text-center">
                  Enter the lab to synthesize new custom logic.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Map size={12} className="text-blue-500" /> Overall Course Mastery
                    </span>
                    <span className="text-xs font-black text-blue-400">
                      {progressStats.courseCompletedModules} / {progressStats.courseTotalModules} Sectors
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(progressStats.courseCompletedModules / Math.max(1, progressStats.courseTotalModules)) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 relative"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]" />
                    </motion.div>
                  </div>
                  <div className="pt-5 border-t border-white/5">
                    <div className="flex justify-between items-center mb-3 gap-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Zap size={12} className="text-emerald-500 shrink-0" /> 
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                          {progressStats.currentModuleTitle || "System Initialization"}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 shrink-0 whitespace-nowrap">
                        {progressStats.moduleCompletedMissions} / {progressStats.moduleTotalMissions} Core
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      {Array.from({ length: progressStats.moduleTotalMissions }).map((_, i) => {
                        const isComplete = i < progressStats.moduleCompletedMissions;
                        const isActive = i === progressStats.moduleCompletedMissions;
                        return (
                          <div 
                            key={i} 
                            className={`h-4 md:h-5 flex-1 rounded-sm border transition-all duration-500 ${
                              isComplete 
                                ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                                : isActive
                                  ? 'bg-blue-500/20 border-blue-400/50 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                  : 'bg-slate-800/50 border-slate-700/50'
                            }`}
                          />
                        );
                      })}
                      <div 
                        className={`h-5 md:h-6 w-8 flex items-center justify-center rounded-md border transition-all duration-500 ml-1 ${
                          progressStats.moduleCompletedMissions === progressStats.moduleTotalMissions && progressStats.moduleTotalMissions > 0
                            ? 'bg-yellow-500 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse'
                            : 'bg-slate-800/50 border-slate-700/50'
                        }`}
                      >
                        <ShieldCheck size={12} className={progressStats.moduleCompletedMissions === progressStats.moduleTotalMissions && progressStats.moduleTotalMissions > 0 ? 'text-black' : 'text-slate-600'} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Link href="/student/courses" className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-slate-600 hover:text-slate-300 transition-colors group/link w-full">
          <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Map size={14} /> See full course map
          </span>
          <ChevronRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* RIGHT SIDE: THE MAIN CTA */}
      <div className="md:w-[45%] relative bg-[#020617] flex flex-col overflow-hidden min-h-[260px] md:min-h-0">
        
        {/* SCENARIO 1: Legacy MakeCode Sandbox */}
        {isMakecodeSandbox ? (
          <div className="relative z-10 p-6 md:p-8 flex flex-col h-full items-center justify-center text-center">
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Open Environment
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
              Hardware Sandbox
            </h3>
            <button 
              onClick={() => router.push(`/student/makecode-sb/${courseData.id}`)}
              className="w-full py-5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 relative overflow-hidden group shadow-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              <Zap className="w-6 h-6 animate-pulse" />
              <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Enter Logic Lab</span>
            </button>
          </div>

        /* SCENARIO 2: The New Video Hub (Scratch & Robotics) */
        ) : isVideoHub ? (
          <div className="relative z-10 p-6 md:p-8 flex flex-col h-full items-center justify-center text-center">
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Active Training
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
              Mission Control
            </h3>
            <button 
              onClick={() => router.push(`/student/video-hub/${courseData.id}`)}
              className="w-full py-5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 relative overflow-hidden group shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:shadow-[0_0_40px_rgba(59,130,246,0.6)]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              <Video className="w-6 h-6 animate-pulse" />
              <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Enter Video Hub</span>
            </button>
          </div>

        /* SCENARIO 3: Legacy Linear Course with an Active Task */
        ) : activeTask ? (
          <>
            <div className="absolute inset-0 z-0">
              {activeTask.moduleVideo ? (
                <video src={activeTask.moduleVideo} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-30 md:opacity-40" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/60 to-transparent" />
            </div>

            <div className="relative z-10 p-6 md:p-8 flex flex-col h-full items-center justify-center text-center">
              <div className="mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  Current Mission
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
                {activeTask.title}
              </h3>
              
              {isPreLaunchLms ? (
                <div className="w-full py-5 px-6 rounded-2xl flex items-center justify-center gap-3 bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed shadow-inner">
                  <Shield className="w-6 h-6" />
                  <span className="font-black uppercase tracking-widest text-sm md:text-base italic">Unlocks May 1st @ 10AM</span>
                </div>
              ) : (
                <button 
                  onClick={() => router.push(`/student/course/${courseData.id}`)}
                  className={`w-full py-5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 relative overflow-hidden group shadow-2xl ${
                    activeTask.type === 'checkpoint' 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:shadow-[0_0_40px_rgba(245,158,11,0.6)]' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-[0_0_40px_rgba(59,130,246,0.6)]'
                  }`}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                  {activeTask.type === 'checkpoint' ? (
                    <>
                      <ShieldCheck className="w-6 h-6 animate-pulse" />
                      <span className="font-black uppercase tracking-widest text-sm md:text-base italic">View Course</span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Map className="w-4 h-4" />
                      </div>
                      <span className="font-black uppercase tracking-widest text-sm md:text-base italic">View Course</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </>

        /* SCENARIO 4: Course Completed / No Active Task */
        ) : (
          <div className="relative z-10 p-6 md:p-8 flex flex-col items-center justify-center h-full text-center bg-black/40">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-4">
              <BatteryCharging className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <span className="text-sm font-black uppercase text-emerald-400 tracking-widest">Hyper-Sleep Active</span>
            <span className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest max-w-[200px]">
              You have cleared all sectors! Rest and recharge your robot for the next drop.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}