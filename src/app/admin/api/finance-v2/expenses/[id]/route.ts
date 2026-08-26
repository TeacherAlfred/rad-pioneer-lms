import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, any> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.due_date !== undefined) patch.due_date = body.due_date;
  if (body.payment_timing !== undefined) patch.payment_timing = body.payment_timing === 'pre_paid' ? 'pre_paid' : 'post_paid';
  if (body.recurring !== undefined) patch.recurring = !!body.recurring;
  if (body.active !== undefined) patch.active = !!body.active;
  patch.updated_at = new Date().toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('monthly_expenses').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('monthly_expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
