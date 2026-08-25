"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, CircleDashed, MinusCircle } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { ConstraintPill } from "../_components/ConstraintPill";
import { TodayBanner } from "../_components/TodayBanner";

const TIER_COLOR: Record<string, string> = {
  now: "bg-rose-100 text-rose-700",
  next: "bg-amber-100 text-amber-700",
  later: "bg-emerald-100 text-emerald-700",
};
const TIER_LABEL: Record<string, string> = { now: "Now", next: "Next", later: "Later" };

const STATE_ICON: Record<string, any> = { done: CheckCircle2, partial: CircleDashed, not_started: MinusCircle };
const STATE_COLOR: Record<string, string> = {
  done: "text-emerald-600",
  partial: "text-amber-600",
  not_started: "text-stone-300",
};
const STATE_CYCLE: Record<string, string> = { not_started: "partial", partial: "done", done: "not_started" };

export default function SystemsStatusPage() {
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/admin/api/dashboard-v2/systems-status");
    const data = await res.json();
    setSystems(data.systems || []);
    setItems(data.items || []);
    setLoading(false);
  }

  async function cycleState(item: any) {
    const nextState = STATE_CYCLE[item.state];
    setSavingId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: nextState } : i)));
    try {
      const res = await fetch(`/admin/api/dashboard-v2/systems-status/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: nextState }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err: any) {
      alert(err.message);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: item.state } : i)));
    } finally {
      setSavingId(null);
    }
  }

  const itemsBySystem = useMemo(() => {
    const map: Record<string, any[]> = {};
    items.forEach((i) => {
      if (!map[i.system_key]) map[i.system_key] = [];
      map[i.system_key].push(i);
    });
    return map;
  }, [items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <DashboardV2Nav />
        <ConstraintPill />
        <TodayBanner />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Systems Status</h1>
          <p className="text-stone-500 text-sm mt-1">The Business Systems Map, updated by clicking instead of editing markdown. Click a checklist item to cycle its state.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {systems.map((system) => (
            <div key={system.key} className="bg-white border border-stone-200 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-black tracking-tight">{system.title}</h3>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${TIER_COLOR[system.priority_tier]}`}>{TIER_LABEL[system.priority_tier]}</span>
              </div>
              <p className="text-xs text-stone-500 mb-4">{system.purpose}</p>
              <div className="space-y-2">
                {(itemsBySystem[system.key] || []).map((item) => {
                  const Icon = STATE_ICON[item.state];
                  return (
                    <button
                      key={item.id}
                      onClick={() => cycleState(item)}
                      disabled={savingId === item.id}
                      className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      <Icon size={16} className={`shrink-0 mt-0.5 ${STATE_COLOR[item.state]}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-800">{item.label}</p>
                        {item.notes && <p className="text-[10px] text-stone-400 mt-0.5">{item.notes}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
