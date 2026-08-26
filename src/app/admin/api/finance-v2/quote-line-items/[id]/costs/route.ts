import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('quote_line_item_costs')
    .select('*, inventory_item:inventory_items(id, name, unit_cost, unit_label)')
    .eq('quote_line_item_id', id)
    .order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { inventory_item_id, quantity } = body;
  if (!inventory_item_id || !quantity || Number(quantity) <= 0) {
    return NextResponse.json({ error: 'inventory_item_id and a positive quantity are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('quote_line_item_costs')
    .insert({ quote_line_item_id: id, inventory_item_id, quantity })
    .select('*, inventory_item:inventory_items(id, name, unit_cost, unit_label)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get('linkId');
  if (!linkId) return NextResponse.json({ error: 'linkId query param is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('quote_line_item_costs').delete().eq('id', linkId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
