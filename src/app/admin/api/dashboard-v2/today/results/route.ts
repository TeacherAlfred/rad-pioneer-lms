import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_CONSTRAINTS = ["lead_volume", "founder_attention", "fulfilment_capacity", "recurring_revenue_quality"];
const VALID_CADENCE = ["daily", "weekly"];

// Starts a new sprint's target result - what the current cycle's focus
// items (see .../today/items) are lagging indicators for.
export async function POST(request: Request) {
  const body = await request.json();
  const { title, constraint_key, metric_key, target_value, cadence, cycle_days } = body as {
    title: string;
    constraint_key?: string;
    metric_key?: string;
    target_value?: number;
    cadence: string;
    cycle_days?: number;
  };

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!VALID_CADENCE.includes(cadence)) return NextResponse.json({ error: `cadence must be one of ${VALID_CADENCE.join(", ")}` }, { status: 400 });
  if (constraint_key && !VALID_CONSTRAINTS.includes(constraint_key)) {
    return NextResponse.json({ error: "Invalid constraint_key" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("dashboard_focus_results")
    .insert({
      title: title.trim(),
      constraint_key: constraint_key || null,
      metric_key: metric_key || null,
      target_value: target_value ?? null,
      cadence,
      cycle_days: cycle_days || 14,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ result: data });
}
