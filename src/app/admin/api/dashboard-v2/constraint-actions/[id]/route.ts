import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { label, target, actual, unit, period_label } = body as {
    label?: string; target?: number | null; actual?: number; unit?: string | null; period_label?: string | null;
  };

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (label !== undefined) update.label = label;
  if (target !== undefined) update.target = target;
  if (actual !== undefined) update.actual = actual;
  if (unit !== undefined) update.unit = unit;
  if (period_label !== undefined) update.period_label = period_label;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('constraint_actions').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('constraint_actions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
