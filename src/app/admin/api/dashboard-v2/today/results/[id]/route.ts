import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Judges a result at the end of its cycle: 'achieved' (move on to the next
// constraint's target) or 'abandoned' (result itself was wrong, not just its
// items) - per the founder's framing, the result stays fixed and only the
// items get adjusted if it's not yet showing after 1-2 weeks, so this route
// is deliberately not used to "adjust" a result, only to close it out.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { title, target_value, status } = body as { title?: string; target_value?: number; status?: string };

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) update.title = title;
  if (target_value !== undefined) update.target_value = target_value;
  if (status !== undefined) {
    if (!["active", "achieved", "abandoned"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = status;
    if (status !== "active") update.achieved_at = new Date().toISOString().split("T")[0];
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("dashboard_focus_results").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
