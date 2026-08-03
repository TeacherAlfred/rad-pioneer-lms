"use client";

import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface CollectionSpeedIndexProps {
  speed: {
    onTime: number;
    late1to7: number;
    late8plus: number;
    uncollected: number;
  };
}

export default function CollectionSpeedIndex({ speed }: CollectionSpeedIndexProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 border-b border-slate-100 pb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-600"/> Collection Speed Index
      </h3>
      
      {/* Stacked Progress Bar */}
      <div className="w-full h-8 rounded-full overflow-hidden flex border border-slate-200 shadow-inner bg-slate-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${speed.onTime}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-500 relative group flex items-center justify-center">
            {speed.onTime > 10 && <span className="text-[10px] font-black text-white">{speed.onTime}%</span>}
        </motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: `${speed.late1to7}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-amber-400 relative group flex items-center justify-center">
            {speed.late1to7 > 10 && <span className="text-[10px] font-black text-white">{speed.late1to7}%</span>}
        </motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: `${speed.late8plus}%` }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-orange-500 relative group flex items-center justify-center">
            {speed.late8plus > 10 && <span className="text-[10px] font-black text-white">{speed.late8plus}%</span>}
        </motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: `${speed.uncollected}%` }} transition={{ duration: 1, delay: 0.6 }} className="h-full bg-rose-500 relative group flex items-center justify-center">
            {speed.uncollected > 10 && <span className="text-[10px] font-black text-white">{speed.uncollected}%</span>}
        </motion.div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"/>
          <div>
            <p className="text-xs font-bold text-slate-900">On Time</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">0-1 Days</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0"/>
          <div>
            <p className="text-xs font-bold text-slate-900">Slightly Late</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">2-7 Days</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0"/>
          <div>
            <p className="text-xs font-bold text-slate-900">Very Late</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">8+ Days</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.5)]"/>
          <div>
            <p className="text-xs font-bold text-rose-600">Uncollected</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">At Risk</p>
          </div>
        </div>
      </div>
    </div>
  );
}