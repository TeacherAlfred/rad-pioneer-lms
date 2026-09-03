import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rangeToCutoffIso, isRangeKey, type RangeKey } from '@/lib/fitness/dateRange';
import { startOfWeek } from '@/lib/fitness/week';

const PER_PAGE = 30;
const CHART_WEEKS_CAP = 26; // for range 'all', the summary totals cover full history but the chart itself stays readable at a 26-week window

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get('range');
  const range: RangeKey = isRangeKey(rangeParam) ? rangeParam : '12w';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

  const cutoff = rangeToCutoffIso(range);
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  // Paginated rows for the detail table.
  let pageQuery = sb
    .from('fitness_activities')
    .select('id, name, sport_type, start_local, distance_m, moving_time_s, avg_cadence, relative_effort, gear_id', { count: 'exact' })
    .order('start_local', { ascending: false })
    .range(from, to);
  if (cutoff) pageQuery = pageQuery.gte('start_local', cutoff);

  // Full (unpaginated) rows for the range, for the dashboard summary/chart
  // above the table - the point of putting graphs first is that they need
  // to reflect the whole filtered range, not just the 30 rows on screen.
  let allQuery = sb.from('fitness_activities').select('start_local, distance_m, moving_time_s, relative_effort').order('start_local', { ascending: true });
  if (cutoff) allQuery = allQuery.gte('start_local', cutoff);

  const [{ data, error, count }, { data: allRows, error: allErr }] = await Promise.all([pageQuery, allQuery]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const gearIds = Array.from(new Set((data ?? []).map((a) => a.gear_id).filter((g): g is string => !!g)));
  const { data: gearRows } = gearIds.length ? await sb.from('fitness_gear').select('id, nickname, brand, model_name').in('id', gearIds) : { data: [] };
  const gearById = new Map((gearRows ?? []).map((g) => [g.id, g.nickname || [g.brand, g.model_name].filter(Boolean).join(' ') || g.id]));

  const activities = (data ?? []).map((a) => ({
    ...a,
    distance_km: Math.round((a.distance_m / 1000) * 100) / 100,
    gear_label: a.gear_id ? gearById.get(a.gear_id) ?? null : null,
  }));

  // ---- Dashboard summary (whole filtered range) ----
  const rows = allRows ?? [];
  const totalDistanceKm = rows.reduce((s, r) => s + (r.distance_m || 0), 0) / 1000;
  const totalMovingTimeS = rows.reduce((s, r) => s + (r.moving_time_s || 0), 0);
  const avgPaceSecPerKm = totalDistanceKm > 0 ? totalMovingTimeS / totalDistanceKm : null;
  const effortRows = rows.filter((r) => r.relative_effort != null);
  const avgRelativeEffort = effortRows.length ? Math.round(effortRows.reduce((s, r) => s + (r.relative_effort || 0), 0) / effortRows.length) : null;

  // ---- Chart series: daily buckets for the 7-day view (a week of weekly
  // buckets would just be one bar), weekly buckets otherwise - capped at
  // CHART_WEEKS_CAP so 'all' doesn't render a 100+ bar chart even though
  // the summary numbers above still reflect the true full history.
  const chartRows = range === 'all' ? rows.filter((r) => new Date(r.start_local) >= new Date(Date.now() - CHART_WEEKS_CAP * 7 * 24 * 60 * 60 * 1000)) : rows;

  const chartSeries: { bucket: string; distance_km: number }[] = [];
  if (range === '7d') {
    const byDay = new Map<string, number>();
    for (const r of chartRows) {
      const day = r.start_local.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (r.distance_m || 0));
    }
    for (const [day, distanceM] of Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      chartSeries.push({ bucket: day, distance_km: Math.round((distanceM / 1000) * 10) / 10 });
    }
  } else {
    const byWeek = new Map<string, number>();
    for (const r of chartRows) {
      const week = startOfWeek(new Date(r.start_local)).toISOString().slice(0, 10);
      byWeek.set(week, (byWeek.get(week) ?? 0) + (r.distance_m || 0));
    }
    for (const [week, distanceM] of Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      chartSeries.push({ bucket: week, distance_km: Math.round((distanceM / 1000) * 10) / 10 });
    }
  }

  return NextResponse.json({
    activities,
    page,
    per_page: PER_PAGE,
    total: count ?? 0,
    total_pages: Math.max(1, Math.ceil((count ?? 0) / PER_PAGE)),
    range,
    summary: {
      total_distance_km: Math.round(totalDistanceKm * 10) / 10,
      total_runs: count ?? 0,
      avg_pace_sec_per_km: avgPaceSecPerKm,
      avg_relative_effort: avgRelativeEffort,
    },
    chart_series: chartSeries,
    chart_granularity: range === '7d' ? 'day' : 'week',
  });
}
