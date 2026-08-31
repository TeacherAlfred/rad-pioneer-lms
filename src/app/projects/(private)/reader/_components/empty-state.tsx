import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
}

export default function EmptyState({ icon: Icon, title, subtitle, badge }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 border-2 border-dashed border-slate-200 rounded-[24px] bg-white/50">
      <div className="relative w-14 h-14 flex items-center justify-center mb-4">
        <motion.div
          className="absolute inset-0 rounded-full bg-amber-100"
          animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        />
        <div className="relative w-12 h-12 bg-amber-50 border border-amber-100 text-amber-600 rounded-full flex items-center justify-center">
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h3>
      <p className="text-xs text-slate-500 mt-1.5 max-w-xs text-center leading-relaxed">{subtitle}</p>
      {badge && (
        <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}
