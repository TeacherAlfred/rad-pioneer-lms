import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(title: string) {
  return String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId');
  if (!seriesId) return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tutorials')
    .select('*')
    .eq('series_id', seriesId)
    .order('order_index', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { series_id, title, description, estimated_minutes, link_url, link_label, order_index } = body;
    if (!series_id) return NextResponse.json({ error: 'series_id is required' }, { status: 400 });
    if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('tutorials')
      .insert([{
        series_id,
        title: String(title).trim(),
        slug: slugify(title),
        description: description || null,
        estimated_minutes: estimated_minutes === '' || estimated_minutes === undefined ? null : Number(estimated_minutes),
        link_url: link_url || null,
        link_label: link_label ? String(link_label).trim() : null,
        order_index: order_index === undefined ? 0 : Number(order_index),
        is_hidden: true,
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { title, description, estimated_minutes, link_url, link_label, order_index, is_hidden } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = description || null;
    if (estimated_minutes !== undefined) update.estimated_minutes = estimated_minutes === '' ? null : Number(estimated_minutes);
    if (link_url !== undefined) update.link_url = link_url || null;
    if (link_label !== undefined) update.link_label = link_label ? String(link_label).trim() : null;
    if (order_index !== undefined) update.order_index = Number(order_index);
    if (is_hidden !== undefined) update.is_hidden = !!is_hidden;

    const { data, error } = await supabaseAdmin.from('tutorials').update(update).eq('id', id).select().single();
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
    const { error } = await supabaseAdmin.from('tutorials').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
