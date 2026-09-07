import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sastDateKey, sastMondayOf, sastWeekday } from '@/lib/sastDate';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const STREAK_LOOKBACK_DAYS = 120;

// Consecutive work days (Mon-Fri) that hit that day's target, walking
// backwards from today. Weekends are skipped entirely - they neither count
// toward nor break the streak. A day with no target defined for its week
// can't be credited (nothing to compare against), so it breaks the streak
// the same as a genuine miss - except when that day is today, which is
// never allowed to break a streak while still in progress: if today hasn't
// hit target yet (or has no target set), it's just skipped so the streak
// reflects "as of yesterday" rather than zeroing out mid-day.
function computeStreak(todayKey: string, processedByDate: Map<string, number>, targetByWeekStart: Map<string, number>): number {
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const dateKey = sastDateKey(cursor);
    const weekday = sastWeekday(cursor); // 0=Sun..6=Sat
    if (weekday !== 0 && weekday !== 6) {
      const isToday = dateKey === todayKey;
      const target = targetByWeekStart.get(sastMondayOf(cursor));
      const processed = processedByDate.get(dateKey) || 0;
      const met = target != null && processed >= target;
      if (met) {
        streak++;
      } else if (!isToday) {
        break;
      }
      // isToday and not yet met (or no target set) - skip without breaking.
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

// Dashboard-card numbers for the Call Queue page - how much is queued, how
// much of that is actually due today, and how much dialing has actually
// happened against target. `target` is a PER-DAY quota (set once for the
// week, applied to each work day - not a single weekly total), so callers
// comparing it against processedThisWeek need to multiply by the number of
// workdays themselves. "Processed" here only ever means a lead_call_queue
// entry marked done by working the queue (logging an outbound contact
// attempt) - replying to an inbound message is a completely separate action
// on Message Activity that never touches this table, so these numbers are
// strictly outbound by construction.
export async function GET() {
  const supabase = supabaseAdmin();
  const now = new Date();
  const todayKey = sastDateKey(now);
  const weekStart = sastMondayOf(now);
  const weekStartAt = new Date(`${weekStart}T00:00:00.000+02:00`).toISOString();
  const weekEndAt = new Date(new Date(weekStartAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const streakCutoffAt = new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: pendingRows, error: pendingError },
    { data: doneRows, error: doneError },
    { data: targetRow, error: targetError },
    { data: streakDoneRows, error: streakDoneError },
    { data: allTargetRows, error: allTargetsError },
  ] = await Promise.all([
    supabase.from('lead_call_queue').select('target_date').eq('status', 'pending'),
    supabase.from('lead_call_queue').select('completed_at').eq('status', 'done').gte('completed_at', weekStartAt).lt('completed_at', weekEndAt),
    supabase.from('call_queue_weekly_targets').select('target').eq('week_start', weekStart).maybeSingle(),
    // Wider window purely for the streak calc below - kept separate from the
    // this-week `doneRows` query above so that one stays a tight, cheap scan.
    supabase.from('lead_call_queue').select('completed_at').eq('status', 'done').gte('completed_at', streakCutoffAt),
    supabase.from('call_queue_weekly_targets').select('week_start, target'),
  ]);
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
  if (doneError) return NextResponse.json({ error: doneError.message }, { status: 500 });
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (streakDoneError) return NextResponse.json({ error: streakDoneError.message }, { status: 500 });
  if (allTargetsError) return NextResponse.json({ error: allTargetsError.message }, { status: 500 });

  const totalInQueue = (pendingRows || []).length;
  const waitingToProcess = (pendingRows || []).filter(r => r.target_date <= todayKey).length;

  const processedByDay: Record<string, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
  for (const row of doneRows || []) {
    if (!row.completed_at) continue;
    const dow = sastWeekday(new Date(row.completed_at)); // 0=Sun..6=Sat
    const idx = dow - 1; // Mon=0 ... Fri=4; Sun=-1, Sat=5 (weekend, not shown per-day)
    if (idx >= 0 && idx <= 4) processedByDay[DAY_KEYS[idx]]++;
  }

  const processedByDate = new Map<string, number>();
  for (const row of streakDoneRows || []) {
    if (!row.completed_at) continue;
    const key = sastDateKey(new Date(row.completed_at));
    processedByDate.set(key, (processedByDate.get(key) || 0) + 1);
  }
  const targetByWeekStart = new Map((allTargetRows || []).map(r => [r.week_start, r.target] as const));
  const streak = computeStreak(todayKey, processedByDate, targetByWeekStart);

  return NextResponse.json({
    weekStart,
    target: targetRow?.target ?? null,
    totalInQueue,
    waitingToProcess,
    processedByDay,
    processedThisWeek: (doneRows || []).length,
    streak,
  });
}

// Sets/updates this week's daily target - upserts by week_start (this SAST
// week's Monday), so it's meant to be set once at the start of the week but
// stays editable if it needs correcting. One number, applied to every work
// day that week - not a weekly total.
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
