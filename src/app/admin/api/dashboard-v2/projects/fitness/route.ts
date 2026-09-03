import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { startOfWeek } from '@/lib/fitness/week';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_WEEKS_FOR_BASELINE = 8;
const RECENT_ACTIVITIES_LIMIT = 15;

export async function GET() {
  const sb = supabaseAdmin();

  const [{ data: token }, { data: activities, error: actErr }, { data: signals }, { data: gear, error: gearErr }] = await Promise.all([
    sb.from('fitness_oauth_tokens').select('athlete_id, connected_at').eq('provider', 'strava').maybeSingle(),
    sb
      .from('fitness_activities')
      .select('id, sport_type, name, start_local, distance_m, moving_time_s, avg_cadence, relative_effort, gear_id, synced_at')
      .order('start_local', { ascending: false })
      .limit(500),
    sb.from('fitness_training_load_signals').select('*').order('parsed_at', { ascending: false }).limit(1),
    sb.from('fitness_gear').select('*').eq('retired', false),
  ]);

  if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });
  if (gearErr) return NextResponse.json({ error: gearErr.message }, { status: 500 });

  const rows = activities ?? [];
  const connected = !!token;
  const lastSyncedAt = rows.reduce<string | null>((max, r) => (!max || r.synced_at > max ? r.synced_at : max), null);

  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const weeksAgo = (n: number) => {
    const d = new Date(thisWeekStart);
    d.setUTCDate(d.getUTCDate() - 7 * n);
    return d;
  };

  const inWeek = (r: (typeof rows)[number], weekStart: Date) => {
    const t = new Date(r.start_local).getTime();
    return t >= weekStart.getTime() && t < weekStart.getTime() + WEEK_MS;
  };

  // Rolling last-7-days vs. the 7 days before that - not calendar Mon-Sun
  // weeks. A calendar-week comparison is misleading for most of the week
  // (a Tuesday "this week" total is 1-2 days of data compared against a
  // full 7-day prior week), so every headline delta here uses a rolling
  // window instead. The weekly_volume trend chart further down still
  // buckets by calendar week - that's a different concern (a readable
  // trend chart) where calendar weeks are the right unit.
  const last7dCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const last7dRows = rows.filter((r) => new Date(r.start_local).getTime() >= last7dCutoff);
  const last7dDistanceKm = last7dRows.reduce((sum, r) => sum + (r.distance_m || 0), 0) / 1000;
  const last7dRuns = last7dRows.length;
  const effortRows = last7dRows.filter((r) => r.relative_effort != null);
  const avgRelativeEffort7d = effortRows.length
    ? Math.round(effortRows.reduce((s, r) => s + (r.relative_effort || 0), 0) / effortRows.length)
    : null;

  const prev7dStart = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const prev7dRows = rows.filter((r) => {
    const t = new Date(r.start_local).getTime();
    return t >= prev7dStart && t < last7dCutoff;
  });
  const prev7dDistanceKm = prev7dRows.reduce((sum, r) => sum + (r.distance_m || 0), 0) / 1000;
  const prev7dRuns = prev7dRows.length;
  const last7dDistanceDeltaPct = prev7dDistanceKm > 0 ? Math.round(((last7dDistanceKm - prev7dDistanceKm) / prev7dDistanceKm) * 100) : null;
  const last7dRunsDelta = last7dRuns - prev7dRuns;

  const prevEffortRows = prev7dRows.filter((r) => r.relative_effort != null);
  const prevAvgRelativeEffort7d = prevEffortRows.length
    ? Math.round(prevEffortRows.reduce((s, r) => s + (r.relative_effort || 0), 0) / prevEffortRows.length)
    : null;
  const avgEffortDeltaPct =
    avgRelativeEffort7d != null && prevAvgRelativeEffort7d != null && prevAvgRelativeEffort7d > 0
      ? Math.round(((avgRelativeEffort7d - prevAvgRelativeEffort7d) / prevAvgRelativeEffort7d) * 100)
      : null;

  // Weekly volume trend: last N weeks, oldest first, for the chart; the
  // trailing average (excluding the current, possibly-incomplete week)
  // doubles as this user's own rolling baseline instead of a hardcoded
  // target - it adapts as his training block changes rather than staying
  // pinned to whatever his volume happened to be when this was built.
  const weeklyVolume: { week_start: string; distance_km: number }[] = [];
  for (let i = RECENT_WEEKS_FOR_BASELINE; i >= 0; i--) {
    const ws = weeksAgo(i);
    const distanceKm = rows.filter((r) => inWeek(r, ws)).reduce((s, r) => s + (r.distance_m || 0), 0) / 1000;
    weeklyVolume.push({ week_start: ws.toISOString().slice(0, 10), distance_km: Math.round(distanceKm * 10) / 10 });
  }
  const priorWeeks = weeklyVolume.slice(0, -1).map((w) => w.distance_km);
  const baselineWeeklyKm = priorWeeks.length ? priorWeeks.reduce((s, v) => s + v, 0) / priorWeeks.length : null;
  const weeklyVolumeRatio = baselineWeeklyKm && baselineWeeklyKm > 0 ? last7dDistanceKm / baselineWeeklyKm : null;

  const gearRows = gear ?? [];
  const shoeAlerts = gearRows
    .filter((g) => g.total_distance_m > g.mileage_alert_threshold_m)
    .map((g) => ({
      id: g.id,
      label: g.nickname || [g.brand, g.model_name].filter(Boolean).join(' ') || g.id,
      total_distance_km: Math.round((g.total_distance_m / 1000) * 10) / 10,
      threshold_km: Math.round((g.mileage_alert_threshold_m / 1000) * 10) / 10,
      over_by_km: Math.round(((g.total_distance_m - g.mileage_alert_threshold_m) / 1000) * 10) / 10,
    }))
    .sort((a, b) => b.over_by_km - a.over_by_km);

  const gearById = new Map(gearRows.map((g) => [g.id, g]));
  const recentActivities = rows.slice(0, RECENT_ACTIVITIES_LIMIT).map((r) => ({
    id: r.id,
    name: r.name,
    sport_type: r.sport_type,
    start_local: r.start_local,
    distance_km: Math.round((r.distance_m / 1000) * 100) / 100,
    moving_time_s: r.moving_time_s,
    avg_cadence: r.avg_cadence,
    relative_effort: r.relative_effort,
    gear_label: r.gear_id ? gearById.get(r.gear_id)?.nickname ?? null : null,
  }));

  return NextResponse.json({
    connected,
    last_synced_at: lastSyncedAt,
    stats: {
      last7d_distance_km: Math.round(last7dDistanceKm * 10) / 10,
      last7d_distance_delta_pct: last7dDistanceDeltaPct,
      last7d_runs: last7dRuns,
      last7d_runs_delta: last7dRunsDelta,
      avg_relative_effort_7d: avgRelativeEffort7d,
      avg_relative_effort_7d_delta_pct: avgEffortDeltaPct,
      baseline_weekly_km: baselineWeeklyKm ? Math.round(baselineWeeklyKm * 10) / 10 : null,
      weekly_volume_ratio: weeklyVolumeRatio,
      active_shoe_alerts: shoeAlerts.length,
    },
    shoe_alerts: shoeAlerts,
    weekly_volume: weeklyVolume,
    recent_activities: recentActivities,
    latest_training_load: signals?.[0] ?? null,
  });
}
