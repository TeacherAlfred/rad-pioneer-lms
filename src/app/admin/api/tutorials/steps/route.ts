import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tutorialId = searchParams.get('tutorialId');
  if (!tutorialId) return NextResponse.json({ error: 'tutorialId is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tutorial_steps')
    .select('*')
    .eq('tutorial_id', tutorialId)
    .order('order_index', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tutorial_id, instruction, image_url, why_this_works, link_url, link_label, order_index } = body;
    if (!tutorial_id) return NextResponse.json({ error: 'tutorial_id is required' }, { status: 400 });
    if (!instruction || !String(instruction).trim()) return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('tutorial_steps')
      .insert([{
        tutorial_id,
        instruction: String(instruction).trim(),
        image_url: image_url || null,
        why_this_works: why_this_works || null,
        link_url: link_url || null,
        link_label: link_label ? String(link_label).trim() : null,
        order_index: order_index === undefined ? 0 : Number(order_index),
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Reordering is a distinct action from a single-field edit: order_index
// carries a unique(tutorial_id, order_index) constraint (migration
// 20260911090000_tutorial_hub_content.sql), so swapping two steps in one
// pass would collide mid-update if applied directly (step A -> step B's
// old value while step B still holds it). Bumping every affected row to a
// negative placeholder first guarantees no collision, since no real
// order_index is ever negative.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body.reorder)) {
      const reorder: { id: string; order_index: number }[] = body.reorder;
      for (let i = 0; i < reorder.length; i++) {
        const { error } = await supabaseAdmin.from('tutorial_steps').update({ order_index: -(i + 1) }).eq('id', reorder[i].id);
        if (error) throw error;
      }
      for (const item of reorder) {
        const { error } = await supabaseAdmin.from('tutorial_steps').update({ order_index: item.order_index, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }

    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { instruction, image_url, why_this_works, link_url, link_label } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (instruction !== undefined) update.instruction = String(instruction).trim();
    if (image_url !== undefined) update.image_url = image_url || null;
    if (why_this_works !== undefined) update.why_this_works = why_this_works || null;
    if (link_url !== undefined) update.link_url = link_url || null;
    if (link_label !== undefined) update.link_label = link_label ? String(link_label).trim() : null;

    const { data, error } = await supabaseAdmin.from('tutorial_steps').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('tutorial_steps').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
