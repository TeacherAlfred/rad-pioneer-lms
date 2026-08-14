import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Bundle = sessions sold together at a fixed price, fixed at purchase
// (e.g. Polokwane's two-day: one MCE-101 session + one ROB-101 session,
// one price) - see RAD_Programme_Model_and_Catalogue.md 2.6.
const BUNDLE_SELECT = `
  *,
  bundle_sessions(id, session_id, sessions(id, starts_at, programme_id, programs(id, code, name)))
`;

export async function GET() {
  const { data, error } = await supabaseAdmin.from('bundles').select(BUNDLE_SELECT).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const { name, description, price, active } = await req.json();
    if (!name || !String(name).trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (price === undefined || price === null || price === '') {
      return NextResponse.json({ error: 'Price is required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('bundles')
      .insert([{ name: String(name).trim(), description: description || null, price: Number(price), active: active === undefined ? true : !!active }])
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
    const { id, name, description, price, active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (description !== undefined) update.description = description || null;
    if (price !== undefined) update.price = Number(price);
    if (active !== undefined) update.active = !!active;
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('bundles').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Cascades to bundle_sessions (on delete cascade). Blocked by Postgres
// if any order still references this bundle - a sold bundle shouldn't
// disappear out from under its purchase record.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('bundles').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
