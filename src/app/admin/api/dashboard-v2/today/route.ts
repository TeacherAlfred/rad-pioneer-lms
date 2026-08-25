import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isLeadQualified, QualificationCheck } from "@/lib/leadQualification";
import {
  evaluateFocusItem,
  computeDailyStreak,
  periodRange,
  sastHour,
  sastDateKey,
  FocusItemRow,
} from "@/lib/dashboard-v2/focusItemEvaluators";

// Glow cutoffs (SAST hour) - per addendum A1.4, glow is state-triggered, not
// schedule-triggered: these hours only gate WHEN we're allowed to check for
// a real condition, they never glow on their own.
const AFTERNOON_CUTOFF_HOUR = 14;
const DAY_END_CUTOFF_HOUR = 19;

export async function GET() {
  const supabase = supabaseAdmin();
  const now = new Date();
  const today = sastDateKey(now);

  const { data: itemRows, error: itemsErr } = await supabase
    .from("dashboard_focus_items")
    .select("id, label, cadence, metric_key, target_value, target_max, sort_order")
    .eq("status", "active")
    .lte("active_from", today)
    .gte("active_until", today)
    .order("cadence")
    .order("sort_order");
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  const items = (itemRows || []) as FocusItemRow[];
  const evaluated = await Promise.all(
    items.map(async (item) => ({ ...item, ...(await evaluateFocusItem(supabase, item, now)) }))
  );

  const dailyItems = evaluated.filter((i) => i.cadence === "daily");
  const weeklyItems = evaluated.filter((i) => i.cadence === "weekly");
  const dailyDone = dailyItems.filter((i) => i.achieved).length;
  const weeklyDone = weeklyItems.filter((i) => i.achieved).length;

  const streak = await computeDailyStreak(
    supabase,
    items.filter((i) => i.cadence === "daily"),
    now
  );

  const allDailyDone = dailyItems.length > 0 && dailyDone === dailyItems.length;
  const hour = sastHour(now);
  let glow: { active: boolean; reason: string | null } = { active: false, reason: null };
  if (!allDailyDone) {
    if (hour >= DAY_END_CUTOFF_HOUR) glow = { active: true, reason: "day_end_open" };
    else if (streak >= 2 && hour >= AFTERNOON_CUTOFF_HOUR) glow = { active: true, reason: "streak_risk" };
    else if (hour >= AFTERNOON_CUTOFF_HOUR) glow = { active: true, reason: "behind_pace" };
  }

  // Result progress - informational context for why these items exist.
  // Deliberately not part of the glow computation, which stays item-only
  // per A1.4 ("the same failure mode Landmine 1 already identified").
  const { data: results } = await supabase
    .from("dashboard_focus_results")
    .select("id, title, constraint_key, metric_key, target_value, cadence, started_at, cycle_days, dashboard_focus_item_results(item_id)")
    .eq("status", "active");

  let resultsWithProgress: any[] = [];
  if (results && results.length > 0) {
    const needsQualifiedLeads = results.some((r: any) => r.metric_key === "qualified_leads_per_day");
    let leads: any[] = [];
    let checksByLead: Record<string, QualificationCheck[]> = {};
    if (needsQualifiedLeads) {
      const [{ data: leadRows }, { data: qualChecks }] = await Promise.all([
        supabase.from("leads").select("id, created_at"),
        supabase.from("lead_qualification_checks").select("lead_id, stage_key, passed"),
      ]);
      leads = leadRows || [];
      (qualChecks || []).forEach((c: any) => {
        (checksByLead[c.lead_id] ||= []).push({ stage_key: c.stage_key, passed: c.passed });
      });
    }

    resultsWithProgress = results.map((r: any) => {
      let current: number | null = null;
      if (r.metric_key === "qualified_leads_per_day") {
        const { start, end } = periodRange("daily", now);
        current = leads.filter((l: any) => {
          const created = new Date(l.created_at).getTime();
          return created >= start.getTime() && created < end.getTime() && isLeadQualified(checksByLead[l.id] || []);
        }).length;
      }
      return {
        id: r.id,
        title: r.title,
        constraint_key: r.constraint_key,
        target_value: r.target_value,
        cadence: r.cadence,
        current,
        itemCount: (r.dashboard_focus_item_results || []).length,
      };
    });
  }

  return NextResponse.json({
    date: today,
    daily: { done: dailyDone, total: dailyItems.length, items: dailyItems },
    weekly: { done: weeklyDone, total: weeklyItems.length, items: weeklyItems },
    streak,
    glow,
    results: resultsWithProgress,
  });
}
