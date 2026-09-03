"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Sparkles, Plus } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../_components/FitnessBreadcrumb";
import { formatDuration, parseDurationInput } from "@/lib/fitness/formatDuration";

type Race = {
  id: string;
  name: string;
  race_date: string;
  distance_m: number;
  activity_id: string | null;
  target_time_s: number | null;
  actual_time_s: number | null;
  source: "strava_auto" | "manual";
  is_upcoming: boolean;
};
type Suggestion = { id: string; name: string; start_local: string; distance_m: number; moving_time_s: number };

const emptyForm = { name: "", race_date: "", distance_km: "", target_time: "", target_pace: "" };

export default function FitnessRacesPage() {
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<Race[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/admin/api/dashboard-v2/projects/fitness/races")
      .then((r) => r.json())
      .then((d) => {
        setRaces(d.races || []);
        setSuggestions(d.suggestions || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function acceptSuggestion(activityId: string) {
    const res = await fetch("/admin/api/dashboard-v2/projects/fitness/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity_id: activityId }),
    });
    if (res.ok) load();
    else alert((await res.json().catch(() => ({}))).error || "Failed to log race");
  }

  function resolveTargetTimeS(): number | null {
    const distanceKm = parseFloat(form.distance_km);
    if (form.target_time) return parseDurationInput(form.target_time);
    if (form.target_pace && distanceKm) {
      const paceSecPerKm = parseDurationInput(form.target_pace);
      return paceSecPerKm != null ? Math.round(paceSecPerKm * distanceKm) : null;
    }
    return null;
  }

  async function addManualRace() {
    if (!form.name || !form.race_date || !form.distance_km) {
      alert("Name, date, and distance are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/fitness/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          race_date: form.race_date,
          distance_m: parseFloat(form.distance_km) * 1000,
          target_time_s: resolveTargetTimeS(),
        }),
      });
      if (!res.ok) {
        alert((await res.json().catch(() => ({}))).error || "Failed to add race");
        return;
      }
      setForm(emptyForm);
      setShowAddForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const upcoming = races.filter((r) => r.is_upcoming);
  const past = [...races.filter((r) => !r.is_upcoming)].reverse();

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Races" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Races</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-stone-300" size={24} />
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <section className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="text-amber-600" size={18} />
                  <h2 className="font-black text-amber-900">Detected from Strava</h2>
                </div>
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-2xl px-5 py-3 border border-amber-100">
                    <div>
                      <p className="font-bold text-stone-800">{s.name}</p>
                      <p className="text-xs text-stone-500">
                        {new Date(s.start_local).toLocaleDateString()} · {(s.distance_m / 1000).toFixed(1)} km · {formatDuration(s.moving_time_s)}
                      </p>
                    </div>
                    <button
                      onClick={() => acceptSuggestion(s.id)}
                      className="bg-stone-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-stone-800 transition-colors"
                    >
                      Log as Race
                    </button>
                  </div>
                ))}
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">Upcoming</h2>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900"
                >
                  <Plus size={14} />
                  Add Race
                </button>
              </div>

              {showAddForm && (
                <div className="bg-white border border-stone-200 rounded-[24px] p-6 mb-4 space-y-3">
                  <input
                    placeholder="Race name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={form.race_date} onChange={(e) => setForm({ ...form, race_date: e.target.value })} className="border border-stone-200 rounded-xl px-3 py-2 text-sm" />
                    <input
                      type="number"
                      placeholder="Distance (km)"
                      value={form.distance_km}
                      onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                      className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        placeholder="Target time (H:MM:SS)"
                        value={form.target_time}
                        onChange={(e) => setForm({ ...form, target_time: e.target.value, target_pace: e.target.value ? "" : form.target_pace })}
                        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">e.g. 4:15:00</p>
                    </div>
                    <div>
                      <input
                        placeholder="or target pace (min/km)"
                        value={form.target_pace}
                        onChange={(e) => setForm({ ...form, target_pace: e.target.value, target_time: e.target.value ? "" : form.target_time })}
                        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">
                        e.g. 6:00 {form.target_pace && form.distance_km && parseDurationInput(form.target_pace) != null
                          ? `→ ${formatDuration(Math.round(parseDurationInput(form.target_pace)! * parseFloat(form.distance_km)))} total`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={addManualRace}
                    disabled={saving}
                    className="bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Race"}
                  </button>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
                <RaceTable races={upcoming} emptyLabel="No upcoming races logged." />
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Past</h2>
              <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
                <RaceTable races={past} emptyLabel="No past races logged." />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function RaceTable({ races, emptyLabel }: { races: Race[]; emptyLabel: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-100 text-left">
          <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Date</th>
          <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Race</th>
          <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Distance</th>
          <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Target</th>
          <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Result</th>
        </tr>
      </thead>
      <tbody>
        {races.map((r) => (
          <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
            <td className="px-6 py-3 text-stone-500 whitespace-nowrap">{new Date(r.race_date + "T00:00:00").toLocaleDateString()}</td>
            <td className="px-6 py-3 font-bold text-stone-800">
              <Link href={`/admin/dashboard-v2/projects/fitness/races/${r.id}`} className="hover:underline">
                {r.name}
              </Link>
            </td>
            <td className="px-6 py-3 text-stone-600">{(r.distance_m / 1000).toFixed(1)} km</td>
            <td className="px-6 py-3 text-stone-600">{formatDuration(r.target_time_s)}</td>
            <td className="px-6 py-3 text-stone-600">{formatDuration(r.actual_time_s)}</td>
          </tr>
        ))}
        {races.length === 0 && (
          <tr>
            <td colSpan={5} className="px-6 py-8 text-center text-stone-400 text-sm">
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
