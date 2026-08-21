"use client";

import { LucideIcon } from "lucide-react";

// Light-theme counterpart to the shared (dark) StatTile - scoped to
// dashboard-v2's 4 screens only, per the design doc's light-theme
// recommendation (§4). The dark StatTile stays as-is for finance-v2/the
// rest of the admin app.
export function LightStatTile({
  label,
  value,
  icon: Icon,
  color = "text-blue-600",
  trend,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color?: string;
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-stone-200 p-6 rounded-[24px] shadow-sm relative overflow-hidden flex flex-col justify-between ${onClick ? "cursor-pointer hover:border-blue-300 transition-colors" : ""}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl bg-stone-50 ${color}`}>
          <Icon size={22} />
        </div>
        {trend && <div className="text-[10px] font-bold text-stone-500 bg-stone-50 px-2 py-1 rounded-full">{trend}</div>}
      </div>
      <div>
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em]">{label}</p>
        <h4 className="text-3xl font-black mt-1 tracking-tight text-stone-900">{value}</h4>
      </div>
    </div>
  );
}
