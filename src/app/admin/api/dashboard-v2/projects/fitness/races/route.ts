import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function GET() {
  const sb = supabaseAdmin();

  const [{ data: races, error: racesErr }, { data: raceActivities, error: actErr }] = await Promise.all([
    sb.from('fitness_races').select('*').order('race_date', { ascending: true }),
    sb
      .from('fitness_activities')
      .select('id, name, start_local, distance_m, moving_time_s')
      .eq('workout_type', 'race')
      .order('start_local', { ascending: false }),
  ]);

  if (racesErr) return NextResponse.json({ error: racesErr.message }, { status: 500 });
  if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const racesWithStatus = (races ?? []).map((r) => ({ ...r, is_upcoming: r.race_date >= today }));

  const linkedActivityIds = new Set((races ?? []).filter((r) => r.activity_id).map((r) => r.activity_id));
  const suggestions = (raceActivities ?? []).filter((a) => !linkedActivityIds.has(a.id));

  return NextResponse.json({ races: racesWithStatus, suggestions });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { activity_id, name, race_date, distance_m, target_time_s, actual_time_s, notes } = body ?? {};

  const sb = supabaseAdmin();

  const insert: Record<string, unknown> = {
    target_time_s: target_time_s ?? null,
    notes: notes ?? null,
  };

  if (activity_id) {
    const { data: activity, error: activityErr } = await sb
      .from('fitness_activities')
      .select('name, start_local, distance_m, moving_time_s')
      .eq('id', activity_id)
      .single();
    if (activityErr || !activity) {
      return NextResponse.json({ error: 'Linked activity not found' }, { status: 400 });
    }
    insert.activity_id = activity_id;
    insert.source = 'strava_auto';
    insert.name = name ?? activity.name;
    insert.race_date = race_date ?? activity.start_local.slice(0, 10);
    insert.distance_m = distance_m ?? activity.distance_m;
    insert.actual_time_s = actual_time_s ?? activity.moving_time_s;
  } else {
    if (!name || !race_date || !distance_m) {
      return NextResponse.json({ error: 'name, race_date, and distance_m are required' }, { status: 400 });
    }
    insert.source = 'manual';
    insert.name = name;
    insert.race_date = race_date;
    insert.distance_m = distance_m;
    insert.actual_time_s = actual_time_s ?? null;
  }

  const { data, error } = await sb.from('fitness_races').insert(insert).select().single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This activity is already logged as a race.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, race: data });
}
