import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Tap-to-log endpoint for 'focus_log' items - each inserted row IS the
// database source of truth for that item's completion (see
// focusItemEvaluators.ts), not a self-reported checkbox that can drift from
// what's actually true.
export async function POST(request: Request) {
  const body = await request.json();
  const { item_id, note } = body as { item_id?: string; note?: string };
  if (!item_id) return NextResponse.json({ error: "item_id is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: item, error: itemErr } = await supabase
    .from("dashboard_focus_items")
    .select("id, metric_key")
    .eq("id", item_id)
    .single();
  if (itemErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (item.metric_key !== "focus_log") {
    return NextResponse.json({ error: "This item is derived automatically and can't be manually logged" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("dashboard_focus_item_logs")
    .insert({ item_id, note: note?.trim() || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

// Undo the most recent tap for an item - covers the actual failure mode
// (mis-tap) without needing a full log-management UI.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const item_id = searchParams.get("item_id");
  if (!item_id) return NextResponse.json({ error: "item_id is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: last } = await supabase
    .from("dashboard_focus_item_logs")
    .select("id")
    .eq("item_id", item_id)
    .order("logged_at", { ascending: false })
    .limit(1);
  if (!last || last.length === 0) return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });

  const { error } = await supabase.from("dashboard_focus_item_logs").delete().eq("id", last[0].id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
