import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { VALID_METRICS } from "@/lib/dashboard-v2/focusItemEvaluators";

// Edits a focus item, or retires it (status: 'retired') - retiring is how a
// habit stops counting toward the banner without deleting its log history.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { label, metric_key, target_value, target_max, active_until, status } = body as {
    label?: string;
    metric_key?: string;
    target_value?: number;
    target_max?: number | null;
    active_until?: string;
    status?: string;
  };

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (label !== undefined) update.label = label;
  if (metric_key !== undefined) {
    // Switching e.g. a tap-logged item over to an auto metric once the
    // system can compute it (Leads Contacted, 2026-09-08) - lets an
    // already-created item switch sources without losing its id/history/
    // result-linking by deleting and recreating it.
    if (!VALID_METRICS.includes(metric_key)) return NextResponse.json({ error: `metric_key must be one of ${VALID_METRICS.join(", ")}` }, { status: 400 });
    update.metric_key = metric_key;
  }
  if (target_value !== undefined) update.target_value = target_value;
  if (target_max !== undefined) update.target_max = target_max;
  if (active_until !== undefined) update.active_until = active_until;
  if (status !== undefined) {
    if (!["active", "retired"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = status;
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("dashboard_focus_items").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
