export type SplitMetric = { distance: number; elapsed_time: number; elevation_difference: number | null; moving_time: number; split: number; average_speed: number };

function formatSplitPace(distanceM: number, movingTimeS: number): string {
  if (!distanceM || !movingTimeS) return "—";
  const secPerKm = movingTimeS / (distanceM / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

/** Shared by the race detail page and the activity detail page - both show the same Strava per-km splits data. */
export function SplitsTable({ splits }: { splits: SplitMetric[] }) {
  if (!splits.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 text-left">
            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Km</th>
            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Pace</th>
            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Elev Δ</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => (
            <tr key={s.split} className="border-b border-stone-50 last:border-0">
              <td className="px-6 py-3 font-bold text-stone-800">{s.split}</td>
              <td className="px-6 py-3 text-stone-600">{formatSplitPace(s.distance, s.moving_time)}</td>
              <td className="px-6 py-3 text-stone-500">{s.elevation_difference != null ? `${Math.round(s.elevation_difference)}m` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
