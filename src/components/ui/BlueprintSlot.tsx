"use client";

import { motion } from "framer-motion";
import { Box } from "lucide-react";

export default function BlueprintSlot({ label, value, isSyncing }: { label: string, value?: string, isSyncing?: boolean }) {
  return (
    <motion.div 
      layout
      className={`p-4 rounded-2xl border transition-all duration-500 ${
        value ? "bg-blue-500/5 border-blue-500/20" : "bg-white/5 border-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${value ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-600"}`}>
          <Box size={16} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <div className="relative">
            <p className={`text-sm font-bold leading-tight ${value ? "text-white" : "text-slate-700 italic"}`}>
              {value || "Awaiting Data..."}
            </p>
            {isSyncing && (
              <motion.div 
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -right-4 top-1 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}