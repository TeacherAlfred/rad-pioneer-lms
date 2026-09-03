"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, Route as RouteIcon, CalendarDays, Gauge, Flame } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { LightStatTile } from "../../../_components/LightStatTile";
import { FitnessBreadcrumb } from "../_components/FitnessBreadcrumb";
import { DateRangeSelector } from "../_components/DateRangeSelector";
import { formatCadence } from "@/lib/fitness/formatCadence";
import { isRangeKey, type RangeKey } from "@/lib/fitness/dateRange";

type ActivityRow = {
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
type Summary = { total_distance_km: number; total_runs: number; avg_pace_sec_per_km: number | null; avg_relative_effort: number | null };
type ChartPoint = { bucket: string; distance_km: number };

function formatPace(distanceKm: number, movingTimeS: number): string {
  if (!distanceKm || !movingTimeS) return "—";
  const secPerKm = movingTimeS / distanceKm;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function formatSecPerKm(secPerKm: number | null): string {
  if (secPerKm == null) return "—";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function FitnessActivitiesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range");
  const range: RangeKey = isRangeKey(rangeParam) ? rangeParam : "12w";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartSeries, setChartSeries] = useState<ChartPoint[]>([]);
  const [chartGranularity, setChartGranularity] = useState<"day" | "week">("week");
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/admin/api/dashboard-v2/projects/fitness/activities?range=${range}&page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setActivities(d.activities || []);
        setSummary(d.summary || null);
        setChartSeries(d.chart_series || []);
        setChartGranularity(d.chart_granularity || "week");
        setTotalPages(d.total_pages || 1);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  }, [range, page]);

  function setRange(newRange: RangeKey) {
    router.push(`/admin/dashboard-v2/projects/fitness/activities?range=${newRange}&page=1`);
  }
  function setPage(newPage: number) {
    router.push(`/admin/dashboard-v2/projects/fitness/activities?range=${range}&page=${newPage}`);
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Activities" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Activities</h1>
              <p className="text-stone-500 text-sm mt-1">{total} activities in this window</p>
            </div>
            <DateRangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-stone-300" size={24} />
          </div>
        ) : (
          <>
            {/* Dashboard first: summary + chart for the whole filtered range,
                before the detail table below - the range's story at a
                glance, not a wall of rows to read one by one. */}
            {summary && (
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <LightStatTile label="Total Distance" value={`${summary.total_distance_km} km`} icon={RouteIcon} color="text-emerald-600" />
                <LightStatTile label="Runs" value={summary.total_runs} icon={CalendarDays} color="text-blue-600" />
                <LightStatTile label="Avg Pace" value={formatSecPerKm(summary.avg_pace_sec_per_km)} icon={Gauge} color="text-violet-600" />
                <LightStatTile label="Avg Effort" value={summary.avg_relative_effort ?? "—"} icon={Flame} color="text-orange-600" />
              </section>
            )}

            {chartSeries.length > 1 && (
              <section className="bg-white border border-stone-200 rounded-[24px] p-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartSeries}>
                    <defs>
                      <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0eee9" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fill: "#a8a29e" }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} width={40} unit="km" />
                    <Tooltip
                      formatter={(v) => [`${v} km`, "Distance"]}
                      labelFormatter={(v) => (chartGranularity === "week" ? `Week of ${new Date(v).toLocaleDateString()}` : new Date(v).toLocaleDateString())}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="distance_km" stroke="#2a78d6" strokeWidth={2} fill="url(#actFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </section>
            )}

            <div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">All Activities</h2>
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
                    {activities.map((a) => (
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
                    {activities.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-stone-400 text-sm">
                          No activities in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span className="text-xs font-bold text-stone-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FitnessActivitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <FitnessActivitiesInner />
    </Suspense>
  );
}
