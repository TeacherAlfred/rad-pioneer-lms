"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Gauge, Mountain, Repeat2, Info, Pencil } from "lucide-react";
import { DashboardV2Nav } from "../../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../../_components/FitnessBreadcrumb";
import { SplitsTable, type SplitMetric } from "../../_components/SplitsTable";
import { formatDuration, parseDurationInput } from "@/lib/fitness/formatDuration";

type Activity = { id: string; name: string; start_local: string; distance_m: number; moving_time_s: number; splits_metric: SplitMetric[] | null };
type Nutrition = {
  plan_carbs_g_per_hr: number | null;
  plan_hydration_strategy: string | null;
  plan_gel_brand: string | null;
  plan_caffeine_timing: string | null;
  plan_notes: string | null;
  actual_carbs_g_per_hr: number | null;
  actual_hydration_notes: string | null;
  actual_gi_issues: string | null;
  actual_fueling_rating: number | null;
  actual_notes: string | null;
} | null;
type Prediction =
  | { available: true; predicted_time_s: number; exponent: number; source_effort: { name: string; moving_time_s: number; start_local: string } }
  | { available: false; reason: string; message: string };
type WeeklyPoint = { week_start: string; value: number; activity_id?: string };
type BackToBack = { first_date: string; second_date: string; first_distance_km: number; second_distance_km: number; combined_distance_km: number; both_weekend_days: boolean };
type UltraTrainingLoad = {
  weeks_to_race: number;
  longest_run_per_week: WeeklyPoint[];
  weekly_elevation_gain_m: WeeklyPoint[];
  back_to_back_long_runs: BackToBack[];
};
type RaceDetail = {
  id: string;
  name: string;
  race_date: string;
  distance_m: number;
  target_time_s: number | null;
  actual_time_s: number | null;
  notes: string | null;
  is_upcoming: boolean;
  activity: Activity | null;
  nutrition: Nutrition;
  prediction?: Prediction;
  ultra_training_load?: UltraTrainingLoad;
};

export default function FitnessRaceDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [race, setRace] = useState<RaceDetail | null>(null);
  const [nutritionForm, setNutritionForm] = useState<NonNullable<Nutrition>>({
    plan_carbs_g_per_hr: null,
    plan_hydration_strategy: null,
    plan_gel_brand: null,
    plan_caffeine_timing: null,
    plan_notes: null,
    actual_carbs_g_per_hr: null,
    actual_hydration_notes: null,
    actual_gi_issues: null,
    actual_fueling_rating: null,
    actual_notes: null,
  });
  const [savingNutrition, setSavingNutrition] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", race_date: "", distance_km: "", target_time: "", target_pace: "", actual_time: "", notes: "" });
  const [savingRace, setSavingRace] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/admin/api/dashboard-v2/projects/fitness/races/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setRace(d);
        if (d.nutrition) setNutritionForm(d.nutrition);
        setEditForm({
          name: d.name ?? "",
          race_date: d.race_date ?? "",
          distance_km: d.distance_m ? String(d.distance_m / 1000) : "",
          target_time: d.target_time_s != null ? formatDuration(d.target_time_s) : "",
          target_pace: "",
          actual_time: d.actual_time_s != null ? formatDuration(d.actual_time_s) : "",
          notes: d.notes ?? "",
        });
      })
      .finally(() => setLoading(false));
  }

  function resolveEditTargetTimeS(): number | null {
    const distanceKm = parseFloat(editForm.distance_km);
    if (editForm.target_time) return parseDurationInput(editForm.target_time);
    if (editForm.target_pace && distanceKm) {
      const paceSecPerKm = parseDurationInput(editForm.target_pace);
      return paceSecPerKm != null ? Math.round(paceSecPerKm * distanceKm) : null;
    }
    return null;
  }

  async function saveRaceDetails() {
    setSavingRace(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/fitness/races/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          race_date: editForm.race_date,
          distance_m: parseFloat(editForm.distance_km) * 1000,
          target_time_s: resolveEditTargetTimeS(),
          actual_time_s: editForm.actual_time ? parseDurationInput(editForm.actual_time) : null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) {
        alert((await res.json().catch(() => ({}))).error || "Failed to save race");
        return;
      }
      setEditing(false);
      load();
    } finally {
      setSavingRace(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveNutrition() {
    setSavingNutrition(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/fitness/races/${params.id}/nutrition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nutritionForm),
      });
      if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Failed to save nutrition");
    } finally {
      setSavingNutrition(false);
    }
  }

  if (loading || !race) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects/fitness/races" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Races
          </Link>
          <FitnessBreadcrumb current={race.name} />
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{race.name}</h1>
            <button
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mt-2 shrink-0"
            >
              <Pencil size={12} />
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {!editing && (
            <p className="text-stone-500 text-sm mt-1">
              {new Date(race.race_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ·{" "}
              {(race.distance_m / 1000).toFixed(1)} km
              {race.target_time_s != null && ` · Target ${formatDuration(race.target_time_s)}`}
              {race.actual_time_s != null && ` · Result ${formatDuration(race.actual_time_s)}`}
            </p>
          )}
        </div>

        {editing && (
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 space-y-3">
            <input
              placeholder="Race name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={editForm.race_date} onChange={(e) => setEditForm({ ...editForm, race_date: e.target.value })} className="border border-stone-200 rounded-xl px-3 py-2 text-sm" />
              <input
                type="number"
                placeholder="Distance (km)"
                value={editForm.distance_km}
                onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  placeholder="Target time (H:MM:SS)"
                  value={editForm.target_time}
                  onChange={(e) => setEditForm({ ...editForm, target_time: e.target.value, target_pace: e.target.value ? "" : editForm.target_pace })}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-stone-400 mt-1">Goal finish time</p>
              </div>
              <div>
                <input
                  placeholder="or pace (min/km)"
                  value={editForm.target_pace}
                  onChange={(e) => setEditForm({ ...editForm, target_pace: e.target.value, target_time: e.target.value ? "" : editForm.target_time })}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  {editForm.target_pace && editForm.distance_km && parseDurationInput(editForm.target_pace) != null
                    ? `→ ${formatDuration(Math.round(parseDurationInput(editForm.target_pace)! * parseFloat(editForm.distance_km)))} total`
                    : "Goal pace"}
                </p>
              </div>
              <div>
                <input
                  placeholder="Actual time (H:MM:SS)"
                  value={editForm.actual_time}
                  onChange={(e) => setEditForm({ ...editForm, actual_time: e.target.value })}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-stone-400 mt-1">If already run</p>
              </div>
            </div>
            <textarea
              placeholder="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              rows={2}
            />
            <button
              onClick={saveRaceDetails}
              disabled={savingRace}
              className="bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {savingRace ? "Saving…" : "Save"}
            </button>
          </section>
        )}

        {race.prediction && (
          <section className="bg-white border border-stone-200 rounded-[24px] p-6">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="text-violet-600" size={18} />
              <h2 className="font-black text-stone-900">Predicted Finish Time</h2>
            </div>
            {race.prediction.available ? (
              <>
                <p className="text-3xl font-black tracking-tight">{formatDuration(race.prediction.predicted_time_s)}</p>
                <p className="text-xs text-stone-400 mt-2">
                  Based on your {race.prediction.source_effort.name} effort ({formatDuration(race.prediction.source_effort.moving_time_s)}) from{" "}
                  {new Date(race.prediction.source_effort.start_local).toLocaleDateString()}, via Riegel&apos;s formula (exponent {race.prediction.exponent}).
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2 text-sm text-stone-500">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>{race.prediction.message}</p>
              </div>
            )}
          </section>
        )}

        {race.ultra_training_load && (
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Mountain className="text-emerald-600" size={18} />
              <h2 className="font-black text-stone-900">Ultra Training Readiness</h2>
              <span className="ml-auto text-xs font-bold text-stone-400">{race.ultra_training_load.weeks_to_race} weeks to go</span>
            </div>
            <p className="text-xs text-stone-400 -mt-4">
              No fabricated finish time for ultra distances — the signals below (long-run build-up, back-to-back long runs, elevation training) are what actually track readiness.
            </p>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Longest Run / Week</p>
              <div className="flex items-end gap-1 h-20">
                {race.ultra_training_load.longest_run_per_week.map((w) => (
                  <div key={w.week_start} title={`${w.week_start}: ${w.value}km`} className="flex-1 bg-emerald-100 rounded-t" style={{ height: `${Math.min(100, (w.value / 40) * 100)}%` }} />
                ))}
                {race.ultra_training_load.longest_run_per_week.length === 0 && <p className="text-sm text-stone-400">No qualifying runs synced yet.</p>}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Weekly Elevation Gain</p>
              <div className="flex items-end gap-1 h-20">
                {race.ultra_training_load.weekly_elevation_gain_m.map((w) => (
                  <div key={w.week_start} title={`${w.week_start}: ${w.value}m`} className="flex-1 bg-amber-100 rounded-t" style={{ height: `${Math.min(100, (w.value / 1000) * 100)}%` }} />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Repeat2 size={14} className="text-stone-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Back-to-Back Long Runs</p>
              </div>
              {race.ultra_training_load.back_to_back_long_runs.length === 0 ? (
                <p className="text-sm text-stone-400">None detected yet in this window.</p>
              ) : (
                <ul className="space-y-1">
                  {race.ultra_training_load.back_to_back_long_runs.slice(0, 5).map((b, i) => (
                    <li key={i} className="text-sm text-stone-600">
                      {b.first_date} ({b.first_distance_km}km) → {b.second_date} ({b.second_distance_km}km) — {b.combined_distance_km}km combined
                      {b.both_weekend_days && <span className="text-stone-400"> · weekend</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {race.activity?.splits_metric && race.activity.splits_metric.length > 0 && (
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Splits</h2>
            <SplitsTable splits={race.activity.splits_metric} />
          </section>
        )}

        {race.activity?.id && (
          <Link
            href={`/admin/dashboard-v2/projects/fitness/activities/${race.activity.id}`}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900"
          >
            View Full Activity →
          </Link>
        )}

        <section className="bg-white border border-stone-200 rounded-[24px] p-6 space-y-6">
          <h2 className="font-black text-stone-900">Nutrition</h2>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Plan</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                type="number"
                placeholder="Carbs g/hr target"
                value={nutritionForm.plan_carbs_g_per_hr ?? ""}
                onChange={(e) => setNutritionForm({ ...nutritionForm, plan_carbs_g_per_hr: e.target.value === "" ? null : parseFloat(e.target.value) })}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="Gel brand"
                value={nutritionForm.plan_gel_brand ?? ""}
                onChange={(e) => setNutritionForm({ ...nutritionForm, plan_gel_brand: e.target.value || null })}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="Caffeine timing"
                value={nutritionForm.plan_caffeine_timing ?? ""}
                onChange={(e) => setNutritionForm({ ...nutritionForm, plan_caffeine_timing: e.target.value || null })}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <input
              placeholder="Hydration strategy"
              value={nutritionForm.plan_hydration_strategy ?? ""}
              onChange={(e) => setNutritionForm({ ...nutritionForm, plan_hydration_strategy: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mb-3"
            />
            <textarea
              placeholder="Race plan notes — whatever doesn't fit the fields above"
              value={nutritionForm.plan_notes ?? ""}
              onChange={(e) => setNutritionForm({ ...nutritionForm, plan_notes: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="border-t border-stone-100 pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Actuals (post-race)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input
                type="number"
                placeholder="Actual carbs g/hr"
                value={nutritionForm.actual_carbs_g_per_hr ?? ""}
                onChange={(e) => setNutritionForm({ ...nutritionForm, actual_carbs_g_per_hr: e.target.value === "" ? null : parseFloat(e.target.value) })}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Fueling felt (1-5)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNutritionForm({ ...nutritionForm, actual_fueling_rating: n })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        nutritionForm.actual_fueling_rating === n ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <input
              placeholder="Hydration notes"
              value={nutritionForm.actual_hydration_notes ?? ""}
              onChange={(e) => setNutritionForm({ ...nutritionForm, actual_hydration_notes: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mb-3"
            />
            <input
              placeholder="GI / gut issues"
              value={nutritionForm.actual_gi_issues ?? ""}
              onChange={(e) => setNutritionForm({ ...nutritionForm, actual_gi_issues: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mb-3"
            />
            <textarea
              placeholder="How it actually went"
              value={nutritionForm.actual_notes ?? ""}
              onChange={(e) => setNutritionForm({ ...nutritionForm, actual_notes: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <button
            onClick={saveNutrition}
            disabled={savingNutrition}
            className="bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {savingNutrition ? "Saving…" : "Save Nutrition"}
          </button>
        </section>
      </div>
    </div>
  );
}
