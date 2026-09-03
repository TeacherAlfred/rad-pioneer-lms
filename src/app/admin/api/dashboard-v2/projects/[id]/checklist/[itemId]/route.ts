import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { itemId } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('label' in body) updates.label = body.label;
  if ('sort_order' in body) updates.sort_order = body.sort_order;
  if ('done' in body) {
    updates.done = body.done;
    updates.done_at = body.done ? new Date().toISOString() : null;
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('project_checklist_items').update(updates).eq('id', itemId).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { itemId } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('project_checklist_items').delete().eq('id', itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
