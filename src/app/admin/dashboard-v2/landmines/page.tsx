"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { ConstraintPill } from "../_components/ConstraintPill";
import { TodayBanner } from "../_components/TodayBanner";

const STATE_OPTIONS = ["ok", "watch", "critical"];
const STATE_COLOR: Record<string, string> = {
  ok: "border-emerald-200 bg-emerald-50",
  watch: "border-amber-200 bg-amber-50",
  critical: "border-rose-200 bg-rose-50",
};
const STATE_BADGE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  watch: "bg-amber-100 text-amber-700",
  critical: "bg-rose-100 text-rose-700",
};

export default function LandminesPage() {
  const [loading, setLoading] = useState(true);
  const [landmines, setLandmines] = useState<any[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { state: string; next_action: string; owner: string }>>({});

  useEffect(() => {
    (async () => {
      const res = await fetch("/admin/api/dashboard-v2/landmines");
      const { landmines: data } = await res.json();
      setLandmines(data || []);
      const initialDrafts: Record<string, any> = {};
      (data || []).forEach((lm: any) => {
        initialDrafts[lm.id] = { state: lm.state, next_action: lm.next_action || "", owner: lm.owner };
      });
      setDrafts(initialDrafts);
      setLoading(false);
    })();
  }, []);

  async function handleSave(id: string) {
    setSavingId(id);
    try {
      const draft = drafts[id];
      const res = await fetch(`/admin/api/dashboard-v2/landmines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Failed to save");
      setLandmines((prev) => prev.map((lm) => (lm.id === id ? { ...lm, ...draft } : lm)));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <DashboardV2Nav />
        <ConstraintPill />
        <TodayBanner />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Landmines &amp; Risk</h1>
          <p className="text-stone-500 text-sm mt-1">The 90-day landmines, tracked instead of re-read from a doc.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {landmines.map((lm) => {
            const draft = drafts[lm.id] || { state: lm.state, next_action: lm.next_action || "", owner: lm.owner };
            return (
              <div key={lm.id} className={`rounded-[24px] border p-6 shadow-sm ${STATE_COLOR[draft.state]}`}>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-black tracking-tight">{lm.title}</h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${STATE_BADGE[draft.state]}`}>{draft.state}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-4">{lm.system.replace(/_/g, " ")}</p>

                <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">State</label>
                <select
                  value={draft.state}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [lm.id]: { ...draft, state: e.target.value } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold mb-3"
                >
                  {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

                <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Next Action</label>
                <textarea
                  value={draft.next_action}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [lm.id]: { ...draft, next_action: e.target.value } }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs mb-3 min-h-[70px] resize-none"
                />

                <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Owner</label>
                <div className="flex gap-2 mb-4">
                  {["founder", "developer"].map((o) => (
                    <button
                      key={o}
                      onClick={() => setDrafts((prev) => ({ ...prev, [lm.id]: { ...draft, owner: o } }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                        draft.owner === o ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-500"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleSave(lm.id)}
                  disabled={savingId === lm.id}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {savingId === lm.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
