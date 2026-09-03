"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { SplitMetric } from "./SplitsTable";

function formatSplitPace(distanceM: number, movingTimeS: number): string {
  if (!distanceM || !movingTimeS) return "—";
  const secPerKm = movingTimeS / (distanceM / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

// Bar height = speed (not raw pace seconds) so a taller bar reads
// intuitively as "faster" - a tired/uphill split looks visibly shorter,
// matching how Strava's own splits chart reads. Exact pace, elevation, and
// split time are all in the tooltip on hover, so nothing is lost versus a
// table - it's just not all sitting on screen as static rows at once.
export function SplitsChart({ splits }: { splits: SplitMetric[] }) {
  if (!splits.length) return null;

  const data = splits.map((s) => ({
    split: s.split,
    speed_kmh: Math.round(s.average_speed * 3.6 * 10) / 10,
    pace: formatSplitPace(s.distance, s.moving_time),
    elevation: s.elevation_difference,
    time: s.moving_time,
  }));

  const avgSpeed = data.reduce((sum, d) => sum + d.speed_kmh, 0) / data.length;
  const fastest = Math.max(...data.map((d) => d.speed_kmh));

  return (
    <div className="bg-white border border-stone-200 rounded-[24px] p-6">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0eee9" vertical={false} />
            <XAxis dataKey="split" tick={{ fontSize: 11, fill: "#a8a29e" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} label={{ value: "km", position: "insideBottom", offset: -2, fontSize: 10, fill: "#a8a29e" }} />
            <YAxis hide domain={[0, (max: number) => max * 1.15]} />
            <Tooltip
              cursor={{ fill: "#f5f5f4" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
              formatter={(value, name, item) => {
                const d = item.payload;
                return [
                  <div key="tip" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{d.pace}</span>
                    <span style={{ color: "#78716c" }}>{d.elevation != null ? `${d.elevation > 0 ? "+" : ""}${Math.round(d.elevation)}m elevation` : "—"}</span>
                  </div>,
                  "",
                ];
              }}
              labelFormatter={(v) => `Km ${v}`}
            />
            <Bar dataKey="speed_kmh" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.speed_kmh === fastest ? "#eb6834" : "#f0b088"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-stone-400 mt-3 text-center">Taller = faster · fastest km highlighted · avg {Math.round(avgSpeed * 10) / 10} km/h</p>
    </div>
  );
}
