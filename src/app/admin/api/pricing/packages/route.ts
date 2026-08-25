import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const EVENT_TYPES = ['workshop', 'term_lessons', 'priority_coaching', 'webinar'];

// Packages joined with their composition (package_items + the inventory_item
// each one points at) - the admin Packages tab needs both in one call to
// render "what's this package made of" without N+1 fetches.
export async function GET() {
  const supabase = supabaseAdmin();
  const [{ data: packages, error: pErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from('packages').select('*').order('name', { ascending: true }),
    supabase.from('package_items').select('*, inventory_item:inventory_items(*)'),
  ]);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  const itemsByPackage = new Map<string, any[]>();
  for (const item of items || []) {
    const list = itemsByPackage.get(item.package_id) || [];
    list.push(item);
    itemsByPackage.set(item.package_id, list);
  }
  const rows = (packages || []).map((p) => ({ ...p, items: itemsByPackage.get(p.id) || [] }));
  return NextResponse.json({ rows });
}

function validatePayload(body: any, { partial }: { partial: boolean }) {
  const { name, event_type } = body;
  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) return 'Name is required';
  }
  if (!partial || event_type !== undefined) {
    if (!EVENT_TYPES.includes(event_type)) return `event_type must be one of: ${EVENT_TYPES.join(', ')}`;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validatePayload(body, { partial: false });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { name, event_type, description, child_facing_blurb, active, recommended_margin_pct, recommended_min_attendance } = body;
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('packages')
      .insert([{
        name: String(name).trim(),
        event_type,
        description: description || null,
        child_facing_blurb: child_facing_blurb || null,
        active: active === undefined ? true : !!active,
        recommended_margin_pct: recommended_margin_pct === '' || recommended_margin_pct === undefined ? null : Number(recommended_margin_pct),
        recommended_min_attendance: recommended_min_attendance === '' || recommended_min_attendance === undefined ? null : Number(recommended_min_attendance),
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: { ...data, items: [] } });
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

    const { name, event_type, description, child_facing_blurb, active, recommended_margin_pct, recommended_min_attendance } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = String(name).trim();
    if (event_type !== undefined) update.event_type = event_type;
    if (description !== undefined) update.description = description || null;
    if (child_facing_blurb !== undefined) update.child_facing_blurb = child_facing_blurb || null;
    if (recommended_margin_pct !== undefined) update.recommended_margin_pct = recommended_margin_pct === '' ? null : Number(recommended_margin_pct);
    if (recommended_min_attendance !== undefined) update.recommended_min_attendance = recommended_min_attendance === '' ? null : Number(recommended_min_attendance);
    if (active !== undefined) update.active = !!active;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from('packages').update(update).eq('id', id).select().single();
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
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
