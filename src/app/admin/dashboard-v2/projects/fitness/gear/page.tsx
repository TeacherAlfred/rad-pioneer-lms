"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../_components/FitnessBreadcrumb";

type Gear = {
  id: string;
  type: "shoes" | "bike";
  brand: string | null;
  model_name: string | null;
  nickname: string | null;
  total_distance_m: number;
  retired: boolean;
  mileage_alert_threshold_m: number;
};

export default function FitnessGearPage() {
  const [loading, setLoading] = useState(true);
  const [gear, setGear] = useState<Gear[]>([]);

  function load() {
    setLoading(true);
    fetch("/admin/api/dashboard-v2/projects/fitness/gear")
      .then((r) => r.json())
      .then((d) => setGear(d.gear || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setGear((prev) => prev.map((g) => (g.id === id ? { ...g, ...body } : g))); // optimistic
    const res = await fetch("/admin/api/dashboard-v2/projects/fitness/gear", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) load(); // reconcile on failure
  }

  const sorted = [...gear].sort((a, b) => {
    const aOver = !a.retired && a.total_distance_m > a.mileage_alert_threshold_m;
    const bOver = !b.retired && b.total_distance_m > b.mileage_alert_threshold_m;
    if (aOver !== bOver) return aOver ? -1 : 1;
    return b.total_distance_m - a.total_distance_m;
  });

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Gear" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Gear</h1>
          <p className="text-stone-500 text-sm mt-1">Populated automatically from Strava on each sync — retire a shoe or adjust its alert threshold below.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-stone-300" size={24} />
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Gear</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Type</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Distance</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Threshold</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Status</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Retired</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => {
                  const km = Math.round((g.total_distance_m / 1000) * 10) / 10;
                  const thresholdKm = Math.round((g.mileage_alert_threshold_m / 1000) * 10) / 10;
                  const over = g.total_distance_m > g.mileage_alert_threshold_m;
                  return (
                    <tr key={g.id} className="border-b border-stone-50 last:border-0">
                      <td className="px-6 py-3 font-bold text-stone-800">{g.nickname || [g.brand, g.model_name].filter(Boolean).join(" ") || g.id}</td>
                      <td className="px-6 py-3 text-stone-500 capitalize">{g.type}</td>
                      <td className="px-6 py-3 text-stone-600">{km} km</td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          defaultValue={thresholdKm}
                          onBlur={(e) => {
                            const km = parseFloat(e.target.value);
                            if (!isNaN(km)) patch(g.id, { mileage_alert_threshold_m: km * 1000 });
                          }}
                          className="w-20 border border-stone-200 rounded-lg px-2 py-1 text-sm"
                        />
                        <span className="text-stone-400 text-xs ml-1">km</span>
                      </td>
                      <td className="px-6 py-3">
                        {g.retired ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">Retired</span>
                        ) : over ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
                            Over by {Math.round((km - thresholdKm) * 10) / 10}km
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">OK</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <input type="checkbox" checked={g.retired} onChange={(e) => patch(g.id, { retired: e.target.checked })} className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-stone-400 text-sm">
                      No gear synced yet — gear appears here after your first Strava sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
