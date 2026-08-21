"use client";

import { motion } from "framer-motion";
import { TrendingUp, LucideIcon } from "lucide-react";

// Generic KPI card, modeled on admin/dashboard/page.tsx's local StatCard
// visual style (rounded-[32px] dark card, icon chip, big italic number) but
// decoupled from that page's own `stats`/`setSelectedStat` state so it can
// be reused anywhere a real metric needs a tile.
export function StatTile({
  label,
  value,
  icon: Icon,
  color = "text-blue-400",
  trend,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color?: string;
  /** e.g. "+12%" - omit if there's no trend figure for this metric yet. */
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -5 } : undefined}
      onClick={onClick}
      className={`bg-[#0f172a] border border-white/10 p-6 rounded-[32px] relative overflow-hidden group transition-all hover:border-blue-500/50 flex flex-col justify-between ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex justify-between items-start relative z-10 mb-6">
        <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
            <TrendingUp size={12} /> {trend}
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
        <h4 className="text-4xl font-black italic mt-1 tracking-tighter">{value}</h4>
      </div>
      <Icon className={`absolute -right-6 -bottom-6 size-32 opacity-[0.03] ${color} group-hover:opacity-10 transition-opacity`} />
    </motion.div>
  );
}
