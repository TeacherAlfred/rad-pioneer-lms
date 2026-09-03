import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

const PATCHABLE_FIELDS = ['title', 'notes', 'due_date', 'recurrence', 'project_id', 'archived', 'sort_order'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = supabaseAdmin();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const { data: task, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.group_ids)) {
    await supabase.from('task_task_groups').delete().eq('task_id', id);
    if (body.group_ids.length > 0) {
      await supabase.from('task_task_groups').insert(body.group_ids.map((group_id: string) => ({ task_id: id, group_id })));
    }
  }

  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
