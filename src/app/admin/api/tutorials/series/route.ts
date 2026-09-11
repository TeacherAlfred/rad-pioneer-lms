import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin reads use the service role so the list always shows every series
// regardless of is_hidden - the public/anon read on /tutorials is the one
// scoped to is_hidden = false (see migration 20260911090000_tutorial_hub_content.sql).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tutorial_series')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

function slugify(title: string) {
  return String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, level, category, estimated_minutes, cover_image_url, sort_order } = body;
    if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('tutorial_series')
      .insert([{
        title: String(title).trim(),
        slug: slugify(title),
        description: description || null,
        level: level || 'beginner',
        category: category || null,
        estimated_minutes: estimated_minutes === '' || estimated_minutes === undefined ? null : Number(estimated_minutes),
        cover_image_url: cover_image_url || null,
        sort_order: sort_order === '' || sort_order === undefined ? 0 : Number(sort_order),
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

    const { title, description, level, category, estimated_minutes, cover_image_url, sort_order, is_hidden } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = description || null;
    if (level !== undefined) update.level = level;
    if (category !== undefined) update.category = category || null;
    if (estimated_minutes !== undefined) update.estimated_minutes = estimated_minutes === '' ? null : Number(estimated_minutes);
    if (cover_image_url !== undefined) update.cover_image_url = cover_image_url || null;
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (is_hidden !== undefined) update.is_hidden = !!is_hidden;

    const { data, error } = await supabaseAdmin.from('tutorial_series').update(update).eq('id', id).select().single();
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
    const { error } = await supabaseAdmin.from('tutorial_series').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
