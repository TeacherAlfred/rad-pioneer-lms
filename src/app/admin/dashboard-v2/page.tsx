"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight, Plus, X, Target } from "lucide-react";
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actions, setActions] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [savingActionId, setSavingActionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/admin/api/dashboard-v2/summary");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load summary");
        setSummary(data);
        setActions(data.constraintActions || []);
      } catch (err: any) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAddAction() {
    if (!newLabel.trim() || !summary) return;
    try {
      const res = await fetch("/admin/api/dashboard-v2/constraint-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constraint_state: summary.constraint.state,
          label: newLabel.trim(),
          target: newTarget ? Number(newTarget) : undefined,
          unit: newUnit.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add action");
      setActions((prev) => [...prev, json.action]);
      setNewLabel("");
      setNewTarget("");
      setNewUnit("");
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpdateAction(id: string, patch: { actual?: number; target?: number | null }) {
    setSavingActionId(id);
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    try {
      const res = await fetch(`/admin/api/dashboard-v2/constraint-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingActionId(null);
    }
  }

  async function handleDeleteAction(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/admin/api/dashboard-v2/constraint-actions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
        <p className="text-rose-600 text-sm font-bold text-center">Couldn't load the constraint summary: {loadError}</p>
      </div>
    );
  }

  if (loading || !summary || !summary.qualification) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">Loading…</p>
      </div>
    );
  }

  const constraintCopy = CONSTRAINT_COPY[summary.constraint.state];
  const maxDaily = Math.max(...summary.dailyCounts.map((d: any) => Math.max(d.count, d.rawCount)), summary.thresholds.leadVolumeThreshold);

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

        {/* CONSTRAINT ACTIONS MODULE (§3.1a) - generic, points at whichever
            system is the current constraint; redefine the rows when the
            constraint moves, don't rebuild the module. */}
        <section className="bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Target size={14} /> Constraint Actions — {constraintCopy.label}
            </h3>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> Add Action
            </button>
          </div>
          <p className="text-[10px] text-stone-400 mb-5">
            Actions are controllable; results are what actually matter — action volume alone can look perfect while the underlying
            conversion is broken, so both are tracked side by side.
          </p>

          {/* Result/ratio pairing - the lagging numbers proving the actions below are converting */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-stone-100">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Raw Leads/Day</p>
              <p className="text-xl font-black tracking-tight">{summary.raw.fourteenDayAvg.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Qualified-Lead Rate</p>
              <p className="text-xl font-black tracking-tight">
                {summary.qualification.qualifiedRate === null ? "—" : `${summary.qualification.qualifiedRate.toFixed(0)}%`}
              </p>
            </div>
          </div>

          {showAddForm && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 mb-4 space-y-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Action label, e.g. Warm-list touches made"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="Target (optional)"
                  type="number"
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Unit, e.g. touches (optional)"
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <button onClick={handleAddAction} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                Save Action
              </button>
            </div>
          )}

          {actions.length === 0 ? (
            <p className="text-xs text-stone-400 italic">
              No actions set for this constraint yet — add the specific, controllable actions for {constraintCopy.label.toLowerCase()}'s channels this period.
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => {
                const pct = action.target ? Math.min(100, (Number(action.actual) / Number(action.target)) * 100) : null;
                return (
                  <div key={action.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className="text-xs font-bold text-stone-800 truncate">{action.label}</p>
                      <button onClick={() => handleDeleteAction(action.id)} className="text-stone-300 hover:text-rose-500 shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={action.actual}
                        disabled={savingActionId === action.id}
                        onChange={(e) => handleUpdateAction(action.id, { actual: Number(e.target.value) })}
                        className="w-16 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-black text-center"
                      />
                      <span className="text-stone-300 text-xs">/</span>
                      <input
                        type="number"
                        value={action.target ?? ""}
                        placeholder="target"
                        disabled={savingActionId === action.id}
                        onChange={(e) => handleUpdateAction(action.id, { target: e.target.value ? Number(e.target.value) : null })}
                        className="w-16 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-black text-center"
                      />
                      {action.unit && <span className="text-[10px] text-stone-400">{action.unit}</span>}
                      {pct !== null && (
                        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* QUALIFICATION TRANSPARENCY NOTE */}
        {summary.qualification.checkedCount < summary.qualification.totalLeads && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 text-xs font-black">i</div>
            <p className="text-xs text-blue-800">
              Only <strong>{summary.qualification.checkedCount} of {summary.qualification.totalLeads}</strong> leads have been qualification-checked so far
              (v1.2's qualification model — see Lead Journey to check more). The numbers above only ever count qualified leads, so they'll look low
              until checking catches up — that's expected, not a sign of a quiet pipeline. Unqualified/raw comparison:{" "}
              <strong>{summary.raw.fourteenDayAvg.toFixed(1)}/day</strong> raw vs. <strong>{summary.constraint.fourteenDayAvg.toFixed(1)}/day</strong> qualified,{" "}
              <strong>{summary.raw.activePipelineCount}</strong> raw active pipeline vs. <strong>{summary.constraint.activePipelineCount}</strong> qualified.
            </p>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SPARKLINE */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-[24px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">14-Day Leads</h3>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Qualified (bars)</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400"><span className="w-2.5 h-0.5 rounded-full bg-blue-500 inline-block" /> Raw (line)</span>
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-32 relative">
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-rose-300 z-20"
                style={{ bottom: `${(summary.thresholds.leadVolumeThreshold / maxDaily) * 100}%` }}
              />
              <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  points={summary.dailyCounts
                    .map((d: any, i: number) => {
                      const x = (i / (summary.dailyCounts.length - 1)) * 100;
                      const y = 100 - (d.rawCount / maxDaily) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                {summary.dailyCounts.map((d: any, i: number) => {
                  const x = (i / (summary.dailyCounts.length - 1)) * 100;
                  const y = 100 - (d.rawCount / maxDaily) * 100;
                  return <circle key={d.date} cx={x} cy={y} r="1.2" fill="#3b82f6" vectorEffect="non-scaling-stroke" />;
                })}
              </svg>
              {summary.dailyCounts.map((d: any) => (
                <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end gap-1 relative z-10">
                  <span className="text-[9px] font-bold text-stone-500">{d.count}</span>
                  <div
                    className={`w-full rounded-t-md ${d.count >= summary.thresholds.leadVolumeThreshold ? "bg-emerald-400" : "bg-stone-300"}`}
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    title={`${d.date}: ${d.count} qualified (${d.rawCount} raw)`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-3">{summary.constraint.fourteenDayAvg.toFixed(1)} qualified avg/day · {summary.raw.fourteenDayAvg.toFixed(1)} raw avg/day over the last 14 days · {summary.totalLeads} total leads · {summary.qualification.checkedCount} checked</p>
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
