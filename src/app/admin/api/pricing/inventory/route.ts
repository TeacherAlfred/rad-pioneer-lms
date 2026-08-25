import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CATEGORIES = ['venue', 'catering', 'materials', 'staffing', 'licensing', 'mentorship', 'other'];
const COST_TYPES = ['flat', 'per_unit', 'per_session'];

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('inventory_items').select('*').order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

function validatePayload(body: any, { partial }: { partial: boolean }) {
  const { name, category, cost_type, unit_cost } = body;
  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) return 'Name is required';
  }
  if (!partial || category !== undefined) {
    if (!CATEGORIES.includes(category)) return `category must be one of: ${CATEGORIES.join(', ')}`;
  }
  if (!partial || cost_type !== undefined) {
    if (!COST_TYPES.includes(cost_type)) return `cost_type must be one of: ${COST_TYPES.join(', ')}`;
  }
  if (unit_cost !== undefined && unit_cost !== null && Number.isNaN(Number(unit_cost))) {
    return 'unit_cost must be a number';
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validatePayload(body, { partial: false });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { name, category, cost_type, unit_cost, unit_label, active, notes } = body;
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{
        name: String(name).trim(),
        category,
        cost_type,
        unit_cost: unit_cost === '' || unit_cost === undefined ? 0 : Number(unit_cost),
        unit_label: unit_label || null,
        active: active === undefined ? true : !!active,
        notes: notes || null,
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

    const { name, category, cost_type, unit_cost, unit_label, active, notes } = body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = String(name).trim();
    if (category !== undefined) update.category = category;
    if (cost_type !== undefined) update.cost_type = cost_type;
    if (unit_cost !== undefined) update.unit_cost = unit_cost === '' ? 0 : Number(unit_cost);
    if (unit_label !== undefined) update.unit_label = unit_label || null;
    if (active !== undefined) update.active = !!active;
    if (notes !== undefined) update.notes = notes || null;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from('inventory_items').update(update).eq('id', id).select().single();
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
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
