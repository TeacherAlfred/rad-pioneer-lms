"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { DashboardV2Nav } from "./_components/DashboardV2Nav";
import { LIFECYCLE_STAGE_LABELS } from "@/lib/funnelStages";

const CONSTRAINT_COPY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  lead_volume: { label: "Lead Volume", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  founder_attention: { label: "Founder Attention", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
};

const LANDMINE_STATE_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  watch: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-rose-100 text-rose-700 border-rose-200",
};

// Forward path only - re_nurture/lost/opted_out are exits/branches, not the
// next linear step, so they're shown separately rather than forced into a
// percentage that would misrepresent them as funnel progression.
const FORWARD_PATH = ["new", "engaged", "qualified", "offered", "won"];

export default function DashboardV2Home() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/admin/api/dashboard-v2/summary");
      const data = await res.json();
      setSummary(data);
      setLoading(false);
    })();
  }, []);

  if (loading || !summary) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">Loading…</p>
      </div>
    );
  }

  const constraintCopy = CONSTRAINT_COPY[summary.constraint.state];
  const maxDaily = Math.max(...summary.dailyCounts.map((d: any) => d.count), summary.thresholds.leadVolumeThreshold);

  const stageByKey = Object.fromEntries(summary.stageCounts.map((s: any) => [s.stage, s.count]));
  const forwardCounts = FORWARD_PATH.map((stage) => stageByKey[stage] || 0);
  const branchStages = summary.stageCounts.filter((s: any) => !FORWARD_PATH.includes(s.stage));

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <DashboardV2Nav />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Constraint Overview</h1>
          <p className="text-stone-500 text-sm mt-1">One screen, once a day — what's actually true right now.</p>
        </header>

        {/* CONSTRAINT BANNER */}
        <section className={`rounded-[24px] border p-8 shadow-sm ${constraintCopy.bg} ${constraintCopy.border}`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${constraintCopy.color}`}>The Constraint Right Now</p>
          <h2 className={`text-2xl md:text-3xl font-black tracking-tight mb-2 ${constraintCopy.color}`}>{constraintCopy.label}</h2>
          <p className="text-sm text-stone-700">{summary.constraint.reason}</p>
          <p className="text-[10px] text-stone-500 mt-4">
            Fulfilment Capacity and Recurring Revenue Quality tiers aren't shown — no waitlist/room-concurrency or MRR-vs-hire-cost
            data is tracked yet to compute them honestly.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SPARKLINE */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">14-Day New Leads</h3>
              <span className="text-[10px] font-bold text-stone-400">Line = {summary.thresholds.leadVolumeThreshold}/day threshold</span>
            </div>
            <div className="flex items-end gap-1.5 h-32 relative">
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-rose-300"
                style={{ bottom: `${(summary.thresholds.leadVolumeThreshold / maxDaily) * 100}%` }}
              />
              {summary.dailyCounts.map((d: any) => (
                <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end gap-1 relative z-10">
                  <span className="text-[9px] font-bold text-stone-500">{d.count}</span>
                  <div
                    className={`w-full rounded-t-md ${d.count >= summary.thresholds.leadVolumeThreshold ? "bg-emerald-400" : "bg-stone-300"}`}
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-3">{summary.constraint.fourteenDayAvg.toFixed(1)} avg/day over the last 14 days · {summary.totalLeads} total leads</p>
          </div>

          {/* STALLED FLAG */}
          <Link href="/admin/dashboard-v2/lead-journey" className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div>
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <Clock size={18} />
                <p className="text-[10px] font-black uppercase tracking-widest">Flagged for Review</p>
              </div>
              <p className="text-4xl font-black tracking-tight">{summary.stalledCount}</p>
              <p className="text-xs text-stone-500 mt-1">leads stalled past their expected stage window</p>
            </div>
            <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1 mt-4">View on Lead Journey <ArrowRight size={12} /></p>
          </Link>
        </div>

        {/* MINI FUNNEL */}
        <section className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Lead Journey — Mini Funnel</h3>
          <div className="flex flex-col md:flex-row items-stretch gap-2 md:gap-0 mb-6">
            {FORWARD_PATH.map((stage, i) => (
              <div key={stage} className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black">{forwardCounts[i]}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">{LIFECYCLE_STAGE_LABELS[stage]}</p>
                </div>
                {i < FORWARD_PATH.length - 1 && (
                  <div className="hidden md:flex flex-col items-center px-2 shrink-0">
                    <ArrowRight size={16} className="text-stone-300" />
                    <span className="text-[9px] font-bold text-stone-400 mt-1">
                      {forwardCounts[i] > 0 ? `${Math.round((forwardCounts[i + 1] / forwardCounts[i]) * 100)}%` : "—"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {branchStages.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-4 border-t border-stone-100">
              {branchStages.map((s: any) => (
                <div key={s.stage} className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs">
                  <span className="font-black">{s.count}</span> <span className="text-stone-500">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LANDMINE CHIPS */}
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Landmines</h3>
              <Link href="/admin/dashboard-v2/landmines" className="text-[10px] font-bold text-blue-600 flex items-center gap-1">View all <ArrowRight size={12} /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {summary.landmines.map((lm: any) => (
                <div key={lm.id} className={`p-4 rounded-xl border ${LANDMINE_STATE_COLOR[lm.state]}`}>
                  <p className="text-xs font-black">{lm.title}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{lm.state}</p>
                </div>
              ))}
            </div>
          </section>

          {/* RECENT AUTO-MOVES */}
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle size={16} className="text-stone-400" />
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">System Auto-Moves (Last 7 Days)</h3>
            </div>
            {summary.recentAutoMoves.length === 0 ? (
              <p className="text-xs text-stone-400 italic">None yet — the nightly job hasn't auto-moved any leads in this window.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {summary.recentAutoMoves.map((m: any, i: number) => (
                  <div key={i} className="p-3 bg-stone-50 rounded-xl text-xs">
                    <p className="font-bold">{m.leads?.name || "Unknown lead"}</p>
                    <p className="text-stone-500">
                      {LIFECYCLE_STAGE_LABELS[m.from_stage] || m.from_stage} → {LIFECYCLE_STAGE_LABELS[m.to_stage] || m.to_stage} · {m.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-stone-400 mt-4">
              Review these on Lead Journey — accept by doing nothing, override by moving the lead to a different stage there.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
