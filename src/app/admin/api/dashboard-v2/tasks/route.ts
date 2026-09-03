import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';
import { isDueToday, isOverdue, isCompletedForCurrentPeriod, Recurrence } from '@/lib/dashboard-v2/taskRecurrence';

// God Mode: every non-archived task in one flat list, regardless of
// grouping, with due_today/overdue/completed_for_period computed server-side
// so the client never has to duplicate the recurrence math.
export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: tasks, error }, { data: taskGroupLinks }, { data: completions }] = await Promise.all([
    supabase.from('tasks').select('*').eq('archived', false).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    supabase.from('task_task_groups').select('task_id, group_id'),
    // 40-day lookback comfortably covers a monthly recurrence's period.
    supabase.from('task_completions').select('task_id, completed_at').gte('completed_at', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groupsByTask = new Map<string, string[]>();
  for (const link of taskGroupLinks || []) {
    const list = groupsByTask.get(link.task_id) || [];
    list.push(link.group_id);
    groupsByTask.set(link.task_id, list);
  }

  const now = new Date();
  const enriched = (tasks || []).map((t) => {
    const recurrence = t.recurrence as Recurrence | null;
    const taskForCalc = { id: t.id, due_date: t.due_date, recurrence, completed_at: t.completed_at };
    return {
      ...t,
      group_ids: groupsByTask.get(t.id) || [],
      due_today: isDueToday(taskForCalc, now),
      overdue: isOverdue(taskForCalc, now),
      completed_for_period: isCompletedForCurrentPeriod(taskForCalc, completions || [], now),
    };
  });

  return NextResponse.json({ tasks: enriched });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const title = (body.title || '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title,
      notes: body.notes || null,
      parent_task_id: body.parent_task_id || null,
      project_id: body.project_id || null,
      due_date: body.due_date || null,
      recurrence: body.recurrence || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.group_ids) && body.group_ids.length > 0) {
    await supabase.from('task_task_groups').insert(body.group_ids.map((group_id: string) => ({ task_id: task.id, group_id })));
  }

  return NextResponse.json({ task });
}
