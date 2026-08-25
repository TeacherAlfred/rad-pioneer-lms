import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_METRICS = ["focus_log", "qualification_checks"];
const VALID_CADENCE = ["daily", "weekly"];

// "As and when" population of new focus items (founder framing, 2026-08-24) -
// this is the self-service surface for it. Defaults to a 2-week active
// window from today, same as the Sprint 1 seed.
export async function POST(request: Request) {
  const body = await request.json();
  const { label, cadence, metric_key, target_value, target_max, active_until, result_id } = body as {
    label: string;
    cadence: string;
    metric_key: string;
    target_value: number;
    target_max?: number;
    active_until?: string;
    result_id?: string;
  };

  if (!label?.trim()) return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (!VALID_CADENCE.includes(cadence)) return NextResponse.json({ error: `cadence must be one of ${VALID_CADENCE.join(", ")}` }, { status: 400 });
  if (!VALID_METRICS.includes(metric_key)) return NextResponse.json({ error: `metric_key must be one of ${VALID_METRICS.join(", ")}` }, { status: 400 });
  if (!target_value || target_value <= 0) return NextResponse.json({ error: "target_value must be a positive number" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: maxRow } = await supabase
    .from("dashboard_focus_items")
    .select("sort_order")
    .eq("cadence", cadence)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const today = new Date().toISOString().split("T")[0];
  const defaultUntil = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: newItem, error } = await supabase
    .from("dashboard_focus_items")
    .insert({
      label: label.trim(),
      cadence,
      metric_key,
      target_value,
      target_max: target_max || null,
      active_from: today,
      active_until: active_until || defaultUntil,
      sort_order: nextSort,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (result_id) {
    await supabase.from("dashboard_focus_item_results").insert({ item_id: newItem.id, result_id });
  }

  return NextResponse.json({ item: newItem });
}
