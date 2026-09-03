"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Route as RouteIcon, Gauge, Flame, Footprints, Mountain, Flag } from "lucide-react";
import { DashboardV2Nav } from "../../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../../_components/FitnessBreadcrumb";
import { LightStatTile } from "../../../../_components/LightStatTile";
import { type SplitMetric } from "../../_components/SplitsTable";
import { SplitsChart } from "../../_components/SplitsChart";
import { formatCadence } from "@/lib/fitness/formatCadence";
import { formatDuration } from "@/lib/fitness/formatDuration";

type Activity = {
  id: string;
  name: string;
  sport_type: string;
  start_local: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  elevation_gain_m: number | null;
  avg_cadence: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  calories: number | null;
  relative_effort: number | null;
  kudos_count: number;
  pr_count: number;
  workout_type: string | null;
  splits_metric: SplitMetric[] | null;
};
type Gear = { id: string; nickname: string | null; brand: string | null; model_name: string | null };
type TrainingLoad = { mileage_flag: string | null; run_health: string | null; injury_risk: "low" | "moderate" | "high" | null; acr_percent: number | null };
type BestEffort = { name: string; distance_m: number; moving_time_s: number; pr_rank: number | null };
type RaceLink = { id: string; name: string } | null;
type Detail = { activity: Activity; gear: Gear | null; training_load: TrainingLoad | null; best_efforts: BestEffort[]; race: RaceLink };

function formatPace(distanceM: number, movingTimeS: number): string {
  if (!distanceM || !movingTimeS) return "—";
  const secPerKm = movingTimeS / (distanceM / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

const injuryColor: Record<string, string> = {
  low: "text-emerald-600 bg-emerald-50",
  moderate: "text-amber-600 bg-amber-50",
  high: "text-rose-600 bg-rose-50",
};

export default function FitnessActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    fetch(`/admin/api/dashboard-v2/projects/fitness/activities/${params.id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading || !data?.activity) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  const { activity, gear, training_load, best_efforts, race } = data;
  const gearLabel = gear ? gear.nickname || [gear.brand, gear.model_name].filter(Boolean).join(" ") || gear.id : null;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects/fitness/activities" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Activities
          </Link>
          <FitnessBreadcrumb current={activity.name} />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{activity.name}</h1>
          <p className="text-stone-500 text-sm mt-1 flex flex-wrap items-center gap-x-2">
            <span>
              {new Date(activity.start_local).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {activity.sport_type}
            </span>
            {activity.workout_type === "race" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <Flag size={10} />
                Race
              </span>
            )}
            {race && (
              <Link href={`/admin/dashboard-v2/projects/fitness/races/${race.id}`} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900">
                → {race.name}
              </Link>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <LightStatTile label="Distance" value={`${(activity.distance_m / 1000).toFixed(2)} km`} icon={RouteIcon} color="text-emerald-600" />
          <LightStatTile label="Pace" value={formatPace(activity.distance_m, activity.moving_time_s)} icon={Gauge} color="text-blue-600" />
          <LightStatTile label="Time" value={formatDuration(activity.moving_time_s)} icon={Footprints} color="text-stone-600" />
          <LightStatTile label="Relative Effort" value={activity.relative_effort ?? "—"} icon={Flame} color="text-orange-600" />
          <LightStatTile label="Cadence" value={formatCadence(activity.avg_cadence) ?? "—"} icon={Footprints} color="text-violet-600" />
          <LightStatTile label="Elevation Gain" value={activity.elevation_gain_m != null ? `${Math.round(activity.elevation_gain_m)} m` : "—"} icon={Mountain} color="text-teal-600" />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-stone-500">
          {activity.avg_heart_rate != null && <span>Avg HR {Math.round(activity.avg_heart_rate)} bpm</span>}
          {activity.calories != null && <span>{Math.round(activity.calories)} cal</span>}
          {gearLabel && (
            <Link href="/admin/dashboard-v2/projects/fitness/gear" className="hover:text-stone-900 hover:underline">
              Worn: {gearLabel}
            </Link>
          )}
          {activity.pr_count > 0 && <span>{activity.pr_count} PR{activity.pr_count > 1 ? "s" : ""}</span>}
        </div>

        {training_load && (
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 flex flex-wrap items-center gap-6">
            {training_load.mileage_flag && <span className="text-3xl">{training_load.mileage_flag}</span>}
            <div className="flex-1 min-w-[200px]">
              <p className="font-bold text-stone-800">{training_load.run_health || "No run-health text parsed"}</p>
              <p className="text-xs text-stone-400 mt-1">Parsed from this activity's Strava description, sourced via Huawei Health.</p>
            </div>
            {training_load.injury_risk && (
              <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${injuryColor[training_load.injury_risk]}`}>
                {training_load.injury_risk} injury risk
              </span>
            )}
            {training_load.acr_percent != null && <span className="text-sm font-bold text-stone-600">ACR {training_load.acr_percent}%</span>}
          </section>
        )}

        {best_efforts.length > 0 && (
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Best Efforts in This Run</h2>
            <div className="flex flex-wrap gap-2">
              {best_efforts.map((be) => (
                <span key={be.name} className="text-xs font-bold text-stone-600 bg-white border border-stone-200 rounded-full px-3 py-1.5">
                  {be.name}: {formatDuration(be.moving_time_s)}
                  {be.pr_rank && <span className="text-amber-600 ml-1">PR #{be.pr_rank}</span>}
                </span>
              ))}
            </div>
          </section>
        )}

        {activity.splits_metric && activity.splits_metric.length > 0 && (
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Splits</h2>
            <SplitsChart splits={activity.splits_metric} />
          </section>
        )}
      </div>
    </div>
  );
}
