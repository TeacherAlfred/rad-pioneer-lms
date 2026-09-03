import { startOfWeek } from './week';

// Pure aggregation over a caller-supplied window of activities, fed by the
// races/[id] API route only when the goal race is ultra distance. 26 weeks
// trailing is long enough to show a real ultra-block build-up trend and
// short enough to stay one readable set of charts - wider than the
// Overview page's 8-week window because ultra base-building trends unfold
// over months, not weeks.
export const ULTRA_TREND_WEEKS = 26;
export const LONG_RUN_THRESHOLD_M = 21100; // half-marathon distance, a standard generic "long run" floor

export type QualifyingActivity = {
  id: string;
  start_local: string;
  distance_m: number;
  elevation_gain_m: number | null;
};

export type WeeklyPoint = { week_start: string; value: number; activity_id?: string };

export function longestRunPerWeek(activities: QualifyingActivity[]): WeeklyPoint[] {
  const byWeek = new Map<string, { distance_m: number; activity_id: string }>();
  for (const a of activities) {
    const week = startOfWeek(new Date(a.start_local)).toISOString().slice(0, 10);
    const current = byWeek.get(week);
    if (!current || a.distance_m > current.distance_m) {
      byWeek.set(week, { distance_m: a.distance_m, activity_id: a.id });
    }
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, v]) => ({ week_start, value: Math.round((v.distance_m / 1000) * 10) / 10, activity_id: v.activity_id }));
}

export function weeklyElevationGain(activities: QualifyingActivity[]): WeeklyPoint[] {
  const byWeek = new Map<string, number>();
  for (const a of activities) {
    const week = startOfWeek(new Date(a.start_local)).toISOString().slice(0, 10);
    byWeek.set(week, (byWeek.get(week) ?? 0) + (a.elevation_gain_m ?? 0));
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, elevation_m]) => ({ week_start, value: Math.round(elevation_m) }));
}

export type BackToBackEvent = {
  first_date: string;
  second_date: string;
  first_distance_km: number;
  second_distance_km: number;
  combined_distance_km: number;
  both_weekend_days: boolean;
};

export function detectBackToBackLongRuns(activities: QualifyingActivity[]): BackToBackEvent[] {
  const longRunsByDate = new Map<string, number>(); // date -> max distance that day
  for (const a of activities) {
    if (a.distance_m < LONG_RUN_THRESHOLD_M) continue;
    const date = a.start_local.slice(0, 10);
    longRunsByDate.set(date, Math.max(longRunsByDate.get(date) ?? 0, a.distance_m));
  }

  const dates = Array.from(longRunsByDate.keys()).sort();
  const events: BackToBackEvent[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const d1 = new Date(dates[i] + 'T00:00:00Z');
    const d2 = new Date(dates[i + 1] + 'T00:00:00Z');
    const gapDays = Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
    if (gapDays === 1) {
      const bothWeekend = [d1, d2].every((d) => {
        const day = d.getUTCDay();
        return day === 0 || day === 6;
      });
      events.push({
        first_date: dates[i],
        second_date: dates[i + 1],
        first_distance_km: Math.round((longRunsByDate.get(dates[i])! / 1000) * 10) / 10,
        second_distance_km: Math.round((longRunsByDate.get(dates[i + 1])! / 1000) * 10) / 10,
        combined_distance_km: Math.round(((longRunsByDate.get(dates[i])! + longRunsByDate.get(dates[i + 1])!) / 1000) * 10) / 10,
        both_weekend_days: bothWeekend,
      });
    }
  }
  return events.reverse(); // newest first
}

export function weeksToRace(raceDate: string, now: Date = new Date()): number {
  const race = new Date(raceDate + 'T00:00:00Z');
  return Math.ceil((race.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export type UltraTrainingLoad = {
  weeks_to_race: number;
  longest_run_per_week: WeeklyPoint[];
  weekly_elevation_gain_m: WeeklyPoint[];
  back_to_back_long_runs: BackToBackEvent[];
};

export function buildUltraTrainingLoad(activities: QualifyingActivity[], raceDate: string, now: Date = new Date()): UltraTrainingLoad {
  return {
    weeks_to_race: weeksToRace(raceDate, now),
    longest_run_per_week: longestRunPerWeek(activities),
    weekly_elevation_gain_m: weeklyElevationGain(activities),
    back_to_back_long_runs: detectBackToBackLongRuns(activities),
  };
}
