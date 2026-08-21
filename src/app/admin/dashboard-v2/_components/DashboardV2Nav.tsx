"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Gauge, Kanban, AlertTriangle, Wallet, LayoutList, Users } from "lucide-react";

// Light theme is deliberate for dashboard-v2 specifically (design doc §4):
// status-colour scanning (red/amber/green) reads faster on light than dark.
// This is a departure from the rest of the admin app's dark theme - scoped
// to these screens only, not applied elsewhere.
const TABS = [
  { label: "Home", path: "/admin/dashboard-v2", icon: Gauge },
  { label: "Lead Journey", path: "/admin/dashboard-v2/lead-journey", icon: Kanban },
  { label: "Landmines & Risk", path: "/admin/dashboard-v2/landmines", icon: AlertTriangle },
  { label: "Systems Status", path: "/admin/dashboard-v2/systems-status", icon: LayoutList },
  { label: "Money & Admin", path: "/admin/dashboard-v2/money-admin", icon: Wallet },
  { label: "Leads", path: "/admin/lead-funnel/overview", icon: Users },
];

export function DashboardV2Nav() {
  const pathname = usePathname();

  return (
    <div className="mb-8">
      <Link href="/admin/dashboard-v2" className="group inline-flex items-center gap-2 bg-white border border-stone-200 hover:border-blue-300 px-4 py-2 rounded-xl transition-all mb-6 shadow-sm">
        <ArrowLeft size={16} className="text-stone-400 group-hover:text-blue-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 group-hover:text-stone-900">Command Center</span>
      </Link>
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-stone-200 w-fit shadow-sm">
        {TABS.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                isActive ? "bg-stone-900 text-white shadow-sm" : "text-stone-500 hover:text-stone-900 hover:bg-stone-50"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
