"use client";

import { useMission } from "@/context/MissionContext";
import PioneerXPBar from "../ui/PioneerXPBar";
import BlueprintSlot from "../ui/BlueprintSlot";
import { LayoutDashboard, Compass, Trophy, Settings } from "lucide-react";

export default function PioneerSidebar() {
  const { stats } = useMission();

  return (
    <aside className="w-80 h-screen bg-slate-950 border-l border-white/5 p-6 flex flex-col gap-8 fixed right-0 top-0 overflow-y-auto">
      {/* 1. Identity Section */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">Pioneer_Status</h3>
        <PioneerXPBar />
      </section>

      {/* 2. Mission Blueprint (The Engagement Loop) */}
      <section className="flex-1 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">Mission_Blueprint</h3>
          <span className="text-[9px] font-bold text-blue-500 px-2 py-0.5 rounded bg-blue-500/10">Active</span>
        </div>
        
        <div className="space-y-3">
          {/* Example Slots - These would normally map from stats.blueprint */}
          <BlueprintSlot label="Variable_Name" value={stats.blueprint.varName} />
          <BlueprintSlot label="Loop_Logic" value={stats.blueprint.loopLogic} />
          <BlueprintSlot label="Asset_Type" value={stats.blueprint.assetType} />
        </div>
      </section>

      {/* 3. Quick Nav */}
      <nav className="pt-6 border-t border-white/5 grid grid-cols-4 gap-2">
        {[LayoutDashboard, Compass, Trophy, Settings].map((Icon, i) => (
          <button key={i} className="aspect-square rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all active:scale-90">
            <Icon size={20} />
          </button>
        ))}
      </nav>
    </aside>
  );
}