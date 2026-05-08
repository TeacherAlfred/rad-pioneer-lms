import { motion } from "framer-motion";
import { Lock, ShieldAlert, Zap } from "lucide-react";

export default function LaunchCountdownBanner({ timeLeft }: { timeLeft: any }) {
  const TimeUnit = ({ label, value }: { label: string, value: number }) => (
    <div className="bg-black/60 border border-amber-500/20 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center shadow-inner relative overflow-hidden group w-full">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="text-4xl md:text-6xl font-black italic tracking-tighter text-amber-500 leading-none drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[9px] md:text-xs font-black text-amber-500/50 uppercase tracking-[0.2em] mt-2">
        {label}
      </span>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-900/40 via-[#020617] to-[#020617] border border-amber-500/30 rounded-[32px] md:rounded-[48px] p-8 md:p-12 mb-8 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col items-center text-center"
    >
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse shadow-[0_0_20px_rgba(245,158,11,1)]" />
      
      <motion.div 
        animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-20 h-20 md:w-24 md:h-24 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.2)] mb-6"
      >
        <Lock size={40} className="text-amber-400" />
      </motion.div>

      <h2 className="text-[10px] md:text-[12px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3 flex items-center justify-center gap-2">
        <ShieldAlert size={16} /> Premium Access Secured
      </h2>
      <h3 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
        Global Launch Sequence <br className="hidden md:block"/> Initiated
      </h3>

      <div className="grid grid-cols-4 gap-2 md:gap-6 w-full max-w-3xl mb-8">
        <TimeUnit label="Days" value={timeLeft.days} />
        <TimeUnit label="Hours" value={timeLeft.hours} />
        <TimeUnit label="Minutes" value={timeLeft.minutes} />
        <TimeUnit label="Seconds" value={timeLeft.seconds} />
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 p-5 md:p-6 rounded-2xl w-full text-left relative overflow-hidden mt-6">
        <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-amber-500/10" />
        <div className="relative z-10">
          <span className="px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded mb-3 inline-block">
            Priority Objective
          </span>
          <div className="space-y-3">
            <p className="text-sm font-bold text-amber-100 leading-relaxed">
              The first 50 students to log in and finish one activity during the launch week will receive an exclusive <span className="text-amber-400 font-black">500 XP Head Start Bonus.</span>
            </p>
            <p className="text-sm font-bold text-amber-100 leading-relaxed border-t border-amber-500/20 pt-3">
              <span className="text-amber-400 font-black uppercase tracking-widest text-[10px] block mb-1">Weekend Leaderboard Bonus:</span>
              The top 3 students with the highest XP by <span className="text-green-500 font-black">Friday 8 May at 23:59</span> will each win <span className="text-amber-400 font-black">2x 1-on-1 Online RAD Lessons!</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}