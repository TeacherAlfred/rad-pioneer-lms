import { SupabaseClient } from "@supabase/supabase-js";

// South Africa is UTC+2 year-round (no DST), so a fixed offset is always
// correct - unlike using the server's own (UTC, on Vercel) local time
// directly, which would put "today" and business-hour cutoffs several hours
// off from what the founder actually experiences as their day.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

export type FocusItemRow = {
  id: string;
  label: string;
  cadence: "daily" | "weekly";
  metric_key: string;
  target_value: number;
  target_max: number | null;
  sort_order: number;
};

// [start, end) UTC instants bounding "today" or "this week" in SAST, for a
// given real UTC `now`. Week starts Monday.
export function periodRange(cadence: "daily" | "weekly", now: Date = new Date()): { start: Date; end: Date } {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  const sastDayStartUTC = Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate());

  if (cadence === "daily") {
    return {
      start: new Date(sastDayStartUTC - SAST_OFFSET_MS),
      end: new Date(sastDayStartUTC + 24 * 60 * 60 * 1000 - SAST_OFFSET_MS),
    };
  }

  const dow = new Date(sastDayStartUTC).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  const weekStartUTC = sastDayStartUTC - daysSinceMonday * 24 * 60 * 60 * 1000;
  return {
    start: new Date(weekStartUTC - SAST_OFFSET_MS),
    end: new Date(weekStartUTC + 7 * 24 * 60 * 60 * 1000 - SAST_OFFSET_MS),
  };
}

export function sastHour(now: Date = new Date()): number {
  return new Date(now.getTime() + SAST_OFFSET_MS).getUTCHours();
}

export function sastDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + SAST_OFFSET_MS).toISOString().split("T")[0];
}

// Every item's completion is a read of an existing database source, never a
// self-reported flag - see the migration file header for why.
export async function evaluateFocusItem(
  supabase: SupabaseClient,
  item: FocusItemRow,
  now: Date = new Date()
): Promise<{ actual: number; achieved: boolean }> {
  const { start, end } = periodRange(item.cadence, now);

  if (item.metric_key === "qualification_checks") {
    const { data } = await supabase
      .from("lead_qualification_checks")
      .select("lead_id")
      .gte("checked_at", start.toISOString())
      .lt("checked_at", end.toISOString());
    const distinctLeads = new Set((data || []).map((r: any) => r.lead_id));
    return { actual: distinctLeads.size, achieved: distinctLeads.size >= item.target_value };
  }

  // 'focus_log' - no other system of record exists for this habit, so the
  // tap-logged row itself is the source of truth (see dashboard_focus_item_logs).
  const { data } = await supabase
    .from("dashboard_focus_item_logs")
    .select("id")
    .eq("item_id", item.id)
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString());
  const actual = (data || []).length;
  return { actual, achieved: actual >= item.target_value };
}

// How many consecutive prior days (not including today) had every active
// daily item achieved - feeds the addendum's "streak at risk" glow trigger.
// Re-evaluates each item as-of each past day rather than reading a stored
// streak counter, since items can be added/retired mid-window and a stored
// counter would silently go stale.
export async function computeDailyStreak(
  supabase: SupabaseClient,
  dailyItems: FocusItemRow[],
  now: Date = new Date(),
  lookbackDays = 14
): Promise<number> {
  if (dailyItems.length === 0) return 0;
  let streak = 0;
  for (let i = 1; i <= lookbackDays; i++) {
    const dayNow = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const results = await Promise.all(dailyItems.map((item) => evaluateFocusItem(supabase, item, dayNow)));
    if (results.every((r) => r.achieved)) streak++;
    else break;
  }
  return streak;
}
