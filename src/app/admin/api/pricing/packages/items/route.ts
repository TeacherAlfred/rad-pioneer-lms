import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const QUANTITY_TYPES = ['per_child', 'flat'];

// 0 copies of an item isn't a real quantity - it means the item doesn't
// belong in this package at all, which is what removing it is for. Allowing
// 0 through created a live bug: the rollup's "no override set" fallback
// (defaulting to ×1) couldn't distinguish a genuine 0 from unset, so a
// quantity_override of 0 silently priced as ×1 instead of being excluded.
function validateQuantityOverride(value: any): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (Number(value) === 0) return 'Quantity can\'t be 0 — remove the item from the package instead.';
  return null;
}

// Add/remove/update one package_items row - a package's composition changes
// one item at a time from the Packages tab, so this is separate from the
// package's own name/description PATCH in ../route.ts.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { package_id, inventory_item_id, quantity_type, quantity_override } = body;
    if (!package_id || !inventory_item_id) return NextResponse.json({ error: 'package_id and inventory_item_id are required' }, { status: 400 });
    if (!QUANTITY_TYPES.includes(quantity_type)) return NextResponse.json({ error: `quantity_type must be one of: ${QUANTITY_TYPES.join(', ')}` }, { status: 400 });
    const overrideErr = validateQuantityOverride(quantity_override);
    if (overrideErr) return NextResponse.json({ error: overrideErr }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('package_items')
      .insert([{
        package_id,
        inventory_item_id,
        quantity_type,
        quantity_override: quantity_override === '' || quantity_override === undefined ? null : Number(quantity_override),
      }])
      .select('*, inventory_item:inventory_items(*)')
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
    const { id, quantity_type, quantity_override } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (quantity_type !== undefined && !QUANTITY_TYPES.includes(quantity_type)) {
      return NextResponse.json({ error: `quantity_type must be one of: ${QUANTITY_TYPES.join(', ')}` }, { status: 400 });
    }
    const overrideErr = validateQuantityOverride(quantity_override);
    if (overrideErr) return NextResponse.json({ error: overrideErr }, { status: 400 });

    const update: Record<string, any> = {};
    if (quantity_type !== undefined) update.quantity_type = quantity_type;
    if (quantity_override !== undefined) update.quantity_override = quantity_override === '' ? null : Number(quantity_override);

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('package_items')
      .update(update)
      .eq('id', id)
      .select('*, inventory_item:inventory_items(*)')
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
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('package_items').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
