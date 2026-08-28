import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, any> = {};
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.as_of_date !== undefined) patch.as_of_date = body.as_of_date;
  if (body.legacy_reference !== undefined) patch.legacy_reference = body.legacy_reference || null;
  if (body.description !== undefined) patch.description = body.description || null;
  patch.updated_at = new Date().toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('lead_balance_forward').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ balance: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('lead_balance_forward').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
