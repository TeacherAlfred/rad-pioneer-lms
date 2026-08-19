import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACCENTS = ['bg-rad-teal', 'bg-rad-blue', 'bg-rad-purple'];

// Landing page carousel cards (src/app/page.tsx "Current Programs").
// Reads here use the service role so the admin list always shows every
// row regardless of its live window - the public/anon read on the
// landing page is the one scoped to live_from/live_until (see migration
// 20260821090000_featured_programs.sql).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('featured_programs')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

function validatePayload(body: any, { partial }: { partial: boolean }) {
  const { title, image_url, accent, live_from, live_until } = body;
  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) return 'Title is required';
  }
  if (!partial || image_url !== undefined) {
    if (!image_url || !String(image_url).trim()) return 'Image URL is required';
  }
  if (accent !== undefined && accent !== null && !ACCENTS.includes(accent)) {
    return `accent must be one of: ${ACCENTS.join(', ')}`;
  }
  if (!partial || live_until !== undefined) {
    if (!live_until) return 'Live until date is required';
  }
  if (live_from && live_until && new Date(live_from) > new Date(live_until)) {
    return 'Live until must be on or after live from';
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validatePayload(body, { partial: false });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      title, label, location, details, duration, form_label,
      image_url, is_video, accent, sort_order, live_from, live_until, date_options,
    } = body;

    const { data, error } = await supabaseAdmin
      .from('featured_programs')
      .insert([{
        title: String(title).trim(),
        label: label ? String(label).trim() : 'Program',
        location: location || null,
        details: details || null,
        duration: duration || null,
        form_label: form_label || null,
        image_url: String(image_url).trim(),
        is_video: !!is_video,
        accent: accent || 'bg-rad-blue',
        sort_order: sort_order === '' || sort_order === undefined ? 0 : Number(sort_order),
        live_from: live_from || new Date().toISOString(),
        live_until,
        date_options: Array.isArray(date_options) ? date_options : [],
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
    const err = validatePayload(body, { partial: true });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      title, label, location, details, duration, form_label,
      image_url, is_video, accent, sort_order, live_from, live_until, date_options,
    } = body;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (date_options !== undefined) update.date_options = Array.isArray(date_options) ? date_options : [];
    if (title !== undefined) update.title = String(title).trim();
    if (label !== undefined) update.label = label ? String(label).trim() : 'Program';
    if (location !== undefined) update.location = location || null;
    if (details !== undefined) update.details = details || null;
    if (duration !== undefined) update.duration = duration || null;
    if (form_label !== undefined) update.form_label = form_label || null;
    if (image_url !== undefined) update.image_url = String(image_url).trim();
    if (is_video !== undefined) update.is_video = !!is_video;
    if (accent !== undefined) update.accent = accent || 'bg-rad-blue';
    if (sort_order !== undefined) update.sort_order = sort_order === '' ? 0 : Number(sort_order);
    if (live_from !== undefined) update.live_from = live_from;
    if (live_until !== undefined) update.live_until = live_until;

    const { data, error } = await supabaseAdmin
      .from('featured_programs')
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

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('featured_programs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
