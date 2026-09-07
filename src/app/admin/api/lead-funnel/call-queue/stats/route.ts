import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sastDateKey, sastMondayOf, sastWeekday } from '@/lib/sastDate';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

// Dashboard-card numbers for the Call Queue page - how much is queued, how
// much of that is actually due today, and how much dialing has actually
// happened this week against the weekly target. "Processed" here only ever
// means a lead_call_queue entry marked done by working the queue (logging
// an outbound contact attempt) - replying to an inbound message is a
// completely separate action on Message Activity that never touches this
// table, so these numbers are strictly outbound by construction.
export async function GET() {
  const supabase = supabaseAdmin();
  const now = new Date();
  const todayKey = sastDateKey(now);
  const weekStart = sastMondayOf(now);
  const weekStartAt = new Date(`${weekStart}T00:00:00.000+02:00`).toISOString();
  const weekEndAt = new Date(new Date(weekStartAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: pendingRows, error: pendingError }, { data: doneRows, error: doneError }, { data: targetRow, error: targetError }] = await Promise.all([
    supabase.from('lead_call_queue').select('target_date').eq('status', 'pending'),
    supabase.from('lead_call_queue').select('completed_at').eq('status', 'done').gte('completed_at', weekStartAt).lt('completed_at', weekEndAt),
    supabase.from('call_queue_weekly_targets').select('target').eq('week_start', weekStart).maybeSingle(),
  ]);
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
  if (doneError) return NextResponse.json({ error: doneError.message }, { status: 500 });
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });

  const totalInQueue = (pendingRows || []).length;
  const waitingToProcess = (pendingRows || []).filter(r => r.target_date <= todayKey).length;

  const processedByDay: Record<string, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
  for (const row of doneRows || []) {
    if (!row.completed_at) continue;
    const dow = sastWeekday(new Date(row.completed_at)); // 0=Sun..6=Sat
    const idx = dow - 1; // Mon=0 ... Fri=4; Sun=-1, Sat=5 (weekend, not shown per-day)
    if (idx >= 0 && idx <= 4) processedByDay[DAY_KEYS[idx]]++;
  }

  return NextResponse.json({
    weekStart,
    target: targetRow?.target ?? null,
    totalInQueue,
    waitingToProcess,
    processedByDay,
    processedThisWeek: (doneRows || []).length,
  });
}

// Sets/updates this week's target - upserts by week_start (this SAST week's
// Monday), so it's meant to be set once at the start of the week but stays
// editable if it needs correcting.
export async function PATCH(req: Request) {
  try {
    const { target } = await req.json();
    if (typeof target !== 'number' || !Number.isFinite(target) || target < 0) {
      return NextResponse.json({ error: 'target must be a non-negative number' }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    const weekStart = sastMondayOf(new Date());
    const { data, error } = await supabase
      .from('call_queue_weekly_targets')
      .upsert({ week_start: weekStart, target, updated_at: new Date().toISOString() }, { onConflict: 'week_start' })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
