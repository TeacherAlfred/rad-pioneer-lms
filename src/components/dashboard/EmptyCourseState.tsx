import { motion } from "framer-motion";
import { Radar, ShieldAlert } from "lucide-react";

export default function EmptyCourseState() {
  return (
    <div className="relative bg-[#0f172a] border border-slate-700/50 rounded-[32px] md:rounded-[48px] overflow-hidden flex flex-col items-center justify-center py-16 md:py-24 shadow-[0_0_40px_rgba(0,0,0,0.3)] text-center px-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="relative z-10">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="w-20 h-20 md:w-24 md:h-24 rounded-full border border-blue-500/30 flex items-center justify-center mb-6 mx-auto relative bg-blue-500/5"
        >
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-pulse" />
          <Radar size={32} className="text-blue-400" />
        </motion.div>

        <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-3">
          Awaiting Assignment
        </h3>
        <p className="text-xs md:text-sm font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
          HQ is currently analyzing your pioneer profile. Your first training sector will be unlocked shortly.
        </p>
        
        <div className="mt-8 inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-xl">
          <ShieldAlert size={14} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Standby for Orders</span>
        </div>
      </div>
    </div>
  );
}