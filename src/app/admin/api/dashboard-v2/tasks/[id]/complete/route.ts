import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

// One-off tasks: completing sets completed_at directly. Recurring tasks:
// completing logs a row in task_completions (the task row itself never
// carries a "done" state) - see the migration header for why.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: task } = await supabase.from('tasks').select('recurrence').eq('id', id).single();
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (task.recurrence) {
    const body = await request.json().catch(() => ({}));
    const { error } = await supabase.from('task_completions').insert({ task_id: id, note: body.note || null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await supabase.from('tasks').update({ completed_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// Undo: for recurring tasks, deletes the most recent completion log row
// (mirrors TodayBanner's "undo last tap"). For one-off tasks, clears
// completed_at.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: task } = await supabase.from('tasks').select('recurrence').eq('id', id).single();
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (task.recurrence) {
    const { data: last } = await supabase
      .from('task_completions')
      .select('id')
      .eq('task_id', id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    if (last) {
      await supabase.from('task_completions').delete().eq('id', last.id);
    }
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await supabase.from('tasks').update({ completed_at: null }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
