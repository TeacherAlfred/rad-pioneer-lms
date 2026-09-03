"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Route as RouteIcon,
  CalendarDays,
  Flame,
  Gauge as GaugeIcon,
  TriangleAlert,
  Activity,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";
import { LightStatTile } from "../../_components/LightStatTile";
import { FitnessBreadcrumb } from "./_components/FitnessBreadcrumb";
import { formatCadence } from "@/lib/fitness/formatCadence";

type ShoeAlert = { id: string; label: string; total_distance_km: number; threshold_km: number; over_by_km: number };
type WeeklyVolumePoint = { week_start: string; distance_km: number };
type RecentActivity = {
  id: string;
  name: string;
  sport_type: string;
  start_local: string;
  distance_km: number;
  moving_time_s: number;
  avg_cadence: number | null;
  relative_effort: number | null;
  gear_label: string | null;
};
type TrainingLoad = {
  activity_id: string;
  mileage_flag: string | null;
  run_health: string | null;
  injury_risk: "low" | "moderate" | "high" | null;
  acr_percent: number | null;
  parsed_at: string;
};
type Overview = {
  connected: boolean;
  last_synced_at: string | null;
  stats: {
    last7d_distance_km: number;
    last7d_distance_delta_pct: number | null;
    last7d_runs: number;
    last7d_runs_delta: number;
    avg_relative_effort_7d: number | null;
    avg_relative_effort_7d_delta_pct: number | null;
    baseline_weekly_km: number | null;
    weekly_volume_ratio: number | null;
    active_shoe_alerts: number;
  };
  shoe_alerts: ShoeAlert[];
  weekly_volume: WeeklyVolumePoint[];
  recent_activities: RecentActivity[];
  latest_training_load: TrainingLoad | null;
};

function formatPace(distanceKm: number, movingTimeS: number): string {
  if (!distanceKm || !movingTimeS) return "—";
  const secPerKm = movingTimeS / distanceKm;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function formatDelta(pct: number | null): string | undefined {
  if (pct == null) return undefined;
  if (pct === 0) return "flat vs previous 7 days";
  return `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs previous 7 days`;
}

const injuryColor: Record<string, string> = {
  low: "text-emerald-600 bg-emerald-50",
  moderate: "text-amber-600 bg-amber-50",
  high: "text-rose-600 bg-rose-50",
};

export default function FitnessOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/fitness")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  const { stats, shoe_alerts, weekly_volume, recent_activities, latest_training_load } = data;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link
            href="/admin/dashboard-v2/projects"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Overview" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Personal Fitness</h1>
          <p className="text-stone-500 text-sm mt-1">
            {data.connected
              ? `Synced with Strava${data.last_synced_at ? ` · last sync ${new Date(data.last_synced_at).toLocaleString()}` : ""}`
              : "Not connected to Strava yet"}
          </p>
        </div>

        {!data.connected ? (
          <div className="bg-white border border-stone-200 rounded-[24px] p-10 text-center">
            <Activity className="mx-auto mb-4 text-stone-300" size={40} />
            <h2 className="text-xl font-black text-stone-900 mb-2">Connect Strava to get started</h2>
            <p className="text-stone-500 text-sm mb-6 max-w-md mx-auto">
              Once connected, activities, gear, and training-load signals sync in automatically each time you hit Sync Now.
            </p>
            <Link
              href="/admin/dashboard-v2/projects/fitness/settings"
              className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-bold px-5 py-3 rounded-full hover:bg-stone-800 transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        ) : (
          <>
            {shoe_alerts.length > 0 && (
              <section className="bg-rose-50 border border-rose-200 rounded-[24px] p-6">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="text-rose-600 shrink-0 mt-0.5" size={22} />
                  <div className="flex-1">
                    <h3 className="font-black text-rose-900 mb-2">Shoe mileage alert</h3>
                    <ul className="space-y-1">
                      {shoe_alerts.map((s) => (
                        <li key={s.id} className="text-sm text-rose-800">
                          <span className="font-bold">{s.label}</span>: {s.total_distance_km}km / {s.threshold_km}km threshold —{" "}
                          <span className="font-bold">over by {s.over_by_km}km</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/admin/dashboard-v2/projects/fitness/gear" className="inline-block mt-3 text-xs font-black uppercase tracking-widest text-rose-700 hover:text-rose-900">
                      View Gear →
                    </Link>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Last 7 Days</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <LightStatTile
                  onClick={() => router.push("/admin/dashboard-v2/projects/fitness/activities?range=7d")}
                  label="Distance"
                  value={`${stats.last7d_distance_km} km`}
                  icon={RouteIcon}
                  color="text-emerald-600"
                  trend={formatDelta(stats.last7d_distance_delta_pct)}
                />
                <LightStatTile
                  onClick={() => router.push("/admin/dashboard-v2/projects/fitness/activities?range=7d")}
                  label="Runs"
                  value={stats.last7d_runs}
                  icon={CalendarDays}
                  color="text-blue-600"
                  trend={stats.last7d_runs_delta !== 0 ? `${stats.last7d_runs_delta > 0 ? "↑" : "↓"} ${Math.abs(stats.last7d_runs_delta)} vs previous 7 days` : "flat vs previous 7 days"}
                />
                <LightStatTile
                  onClick={() => router.push("/admin/dashboard-v2/projects/fitness/activities?range=7d")}
                  label="Avg Relative Effort (7d)"
                  value={stats.avg_relative_effort_7d ?? "—"}
                  icon={Flame}
                  color="text-orange-600"
                  trend={formatDelta(stats.avg_relative_effort_7d_delta_pct)}
                />
                <LightStatTile
                  onClick={() => router.push("/admin/dashboard-v2/projects/fitness/activities?range=12w")}
                  label="Volume vs. Baseline"
                  value={stats.weekly_volume_ratio != null ? `${Math.round(stats.weekly_volume_ratio * 100)}%` : "—"}
                  icon={GaugeIcon}
                  color="text-violet-600"
                  trend={stats.baseline_weekly_km != null ? `baseline ${stats.baseline_weekly_km} km/wk` : undefined}
                />
                <LightStatTile
                  label="Latest ACR"
                  value={latest_training_load?.acr_percent != null ? `${latest_training_load.acr_percent}%` : "—"}
                  icon={Activity}
                  color="text-teal-600"
                />
                <LightStatTile
                  onClick={() => router.push("/admin/dashboard-v2/projects/fitness/gear")}
                  label="Active Shoe Alerts"
                  value={stats.active_shoe_alerts}
                  icon={TriangleAlert}
                  color="text-rose-600"
                />
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Weekly Volume</h2>
              <div className="bg-white border border-stone-200 rounded-[24px] p-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekly_volume}>
                    <defs>
                      <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0eee9" vertical={false} />
                    <XAxis dataKey="week_start" tick={{ fontSize: 11, fill: "#a8a29e" }} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} width={40} unit="km" />
                    <Tooltip
                      formatter={(v) => [`${v} km`, "Distance"]}
                      labelFormatter={(v) => `Week of ${new Date(v).toLocaleDateString()}`}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="distance_km" stroke="#059669" strokeWidth={2} fill="url(#volFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {latest_training_load && (
              <section>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Latest Training Load (myTF.run)</h2>
                <div className="bg-white border border-stone-200 rounded-[24px] p-6 flex flex-wrap items-center gap-6">
                  {latest_training_load.mileage_flag && <span className="text-3xl">{latest_training_load.mileage_flag}</span>}
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold text-stone-800">{latest_training_load.run_health || "No run-health text parsed"}</p>
                    <p className="text-xs text-stone-400 mt-1">Parsed from a synced activity's Strava description, sourced via Huawei Health — not a Strava-native metric.</p>
                  </div>
                  {latest_training_load.injury_risk && (
                    <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${injuryColor[latest_training_load.injury_risk]}`}>
                      {latest_training_load.injury_risk} injury risk
                    </span>
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">Recent Activities</h2>
                <Link href="/admin/dashboard-v2/projects/fitness/activities" className="text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900">
                  View All →
                </Link>
              </div>
              <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left">
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Date</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Name</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Distance</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Pace</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Cadence</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Effort</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Gear</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_activities.map((a) => (
                      <tr key={a.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-pointer">
                        <td className="px-6 py-3 text-stone-500 whitespace-nowrap">
                          <Link href={`/admin/dashboard-v2/projects/fitness/activities/${a.id}`} className="block">
                            {new Date(a.start_local).toLocaleDateString()}
                          </Link>
                        </td>
                        <td className="px-6 py-3 font-bold text-stone-800">
                          <Link href={`/admin/dashboard-v2/projects/fitness/activities/${a.id}`} className="block hover:underline">
                            {a.name}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-stone-600">{a.distance_km} km</td>
                        <td className="px-6 py-3 text-stone-600">{formatPace(a.distance_km, a.moving_time_s)}</td>
                        <td className="px-6 py-3 text-stone-600">{formatCadence(a.avg_cadence) ?? "—"}</td>
                        <td className="px-6 py-3 text-stone-600">{a.relative_effort ?? "—"}</td>
                        <td className="px-6 py-3 text-stone-500">{a.gear_label ?? "—"}</td>
                      </tr>
                    ))}
                    {recent_activities.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-stone-400 text-sm">
                          No activities synced yet — hit Sync Now in Settings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
