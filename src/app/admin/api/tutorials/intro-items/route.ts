import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId');
  if (!seriesId) return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tutorial_series_intro_items')
    .select('*')
    .eq('series_id', seriesId)
    .order('order_index', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { series_id, title, instruction, image_url, hotspots, link_url, link_label, order_index } = body;
    if (!series_id) return NextResponse.json({ error: 'series_id is required' }, { status: 400 });
    if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!instruction || !String(instruction).trim()) return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('tutorial_series_intro_items')
      .insert([{
        series_id,
        title: String(title).trim(),
        instruction: String(instruction).trim(),
        image_url: image_url || null,
        hotspots: Array.isArray(hotspots) ? hotspots : [],
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

// Reordering mirrors the tutorial_steps route: order_index carries a
// unique(series_id, order_index) constraint, so swapping two items needs
// the negative-placeholder two-phase update to avoid a mid-update collision.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body.reorder)) {
      const reorder: { id: string; order_index: number }[] = body.reorder;
      for (let i = 0; i < reorder.length; i++) {
        const { error } = await supabaseAdmin.from('tutorial_series_intro_items').update({ order_index: -(i + 1) }).eq('id', reorder[i].id);
        if (error) throw error;
      }
      for (const item of reorder) {
        const { error } = await supabaseAdmin.from('tutorial_series_intro_items').update({ order_index: item.order_index, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }

    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { title, instruction, image_url, hotspots, link_url, link_label } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = String(title).trim();
    if (instruction !== undefined) update.instruction = String(instruction).trim();
    if (image_url !== undefined) update.image_url = image_url || null;
    if (hotspots !== undefined) update.hotspots = Array.isArray(hotspots) ? hotspots : [];
    if (link_url !== undefined) update.link_url = link_url || null;
    if (link_label !== undefined) update.link_label = link_label ? String(link_label).trim() : null;

    const { data, error } = await supabaseAdmin.from('tutorial_series_intro_items').update(update).eq('id', id).select().single();
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
    const { error } = await supabaseAdmin.from('tutorial_series_intro_items').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
