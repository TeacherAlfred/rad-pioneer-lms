import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from('template_rollouts').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row: data });
}

// Covers every draft-editable field plus the lane hand-off fields written
// back from Bot Flows (linked_bot_flow_id/lane_completed_at) - one partial
// update, same shape as admin/api/lead-funnel's PATCH.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name, category, language, body_text, header_text, footer_text,
      placeholder_labels, placeholder_samples, buttons,
      lane, linked_bot_flow_id, lane_completed_at, status,
    } = body;

    // The only status transition PATCH is allowed to make directly - "Edit
    // and resubmit" after a rejection, dropping the row back to editable
    // (submit/route.ts is the only path that can move it forward again).
    if (status !== undefined) {
      if (status !== 'draft') {
        return NextResponse.json({ error: 'status can only be set to draft (to edit and resubmit a rejected template)' }, { status: 400 });
      }
      const { data: current } = await supabaseAdmin.from('template_rollouts').select('status').eq('id', id).maybeSingle();
      if (current?.status !== 'rejected') {
        return NextResponse.json({ error: 'Only a rejected rollout can be reopened for editing.' }, { status: 400 });
      }
    }

    const update: Record<string, any> = {};
    if (status !== undefined) update.status = status;
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (language !== undefined) update.language = language;
    if (body_text !== undefined) update.body_text = body_text;
    if (header_text !== undefined) update.header_text = header_text || null;
    if (footer_text !== undefined) update.footer_text = footer_text || null;
    if (placeholder_labels !== undefined) update.placeholder_labels = placeholder_labels;
    if (placeholder_samples !== undefined) update.placeholder_samples = placeholder_samples;
    if (buttons !== undefined) update.buttons = buttons;
    if (lane !== undefined) update.lane = lane;
    if (linked_bot_flow_id !== undefined) update.linked_bot_flow_id = linked_bot_flow_id;
    if (lane_completed_at !== undefined) update.lane_completed_at = lane_completed_at;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('template_rollouts')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
