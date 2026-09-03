import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';
import { isUltraDistance, predictRaceTime } from '@/lib/fitness/racePrediction';
import { buildUltraTrainingLoad, ULTRA_TREND_WEEKS } from '@/lib/fitness/ultraTrainingLoad';
import { RUN_SPORT_TYPES } from '@/lib/fitness/workoutType';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: race, error: raceErr } = await sb.from('fitness_races').select('*').eq('id', id).single();
  if (raceErr || !race) return NextResponse.json({ error: 'Race not found' }, { status: 404 });

  const [{ data: activity }, { data: nutrition }] = await Promise.all([
    race.activity_id ? sb.from('fitness_activities').select('*').eq('id', race.activity_id).single() : Promise.resolve({ data: null }),
    sb.from('fitness_race_nutrition').select('*').eq('race_id', id).maybeSingle(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const base = { ...race, is_upcoming: race.race_date >= today, activity: activity ?? null, nutrition: nutrition ?? null };

  if (isUltraDistance(race.distance_m)) {
    const cutoff = new Date(Date.now() - ULTRA_TREND_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivities } = await sb
      .from('fitness_activities')
      .select('id, start_local, distance_m, elevation_gain_m')
      .in('sport_type', Array.from(RUN_SPORT_TYPES))
      .gte('start_local', cutoff)
      .order('start_local', { ascending: true });

    return NextResponse.json({
      ...base,
      ultra_training_load: buildUltraTrainingLoad(recentActivities ?? [], race.race_date),
    });
  }

  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: efforts } = await sb
    .from('fitness_best_efforts')
    .select('name, distance_m, moving_time_s, start_local')
    .gte('start_local', twelveWeeksAgo);

  return NextResponse.json({
    ...base,
    prediction: predictRaceTime(efforts ?? [], race.distance_m),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const { name, race_date, distance_m, activity_id, target_time_s, actual_time_s, notes } = body ?? {};

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) update.name = name;
  if (race_date !== undefined) update.race_date = race_date;
  if (distance_m !== undefined) update.distance_m = distance_m;
  if (activity_id !== undefined) update.activity_id = activity_id;
  if (target_time_s !== undefined) update.target_time_s = target_time_s;
  if (actual_time_s !== undefined) update.actual_time_s = actual_time_s;
  if (notes !== undefined) update.notes = notes;

  const sb = supabaseAdmin();
  const { data, error } = await sb.from('fitness_races').update(update).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This activity is already logged as a race.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, race: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const sb = supabaseAdmin();
  const { error } = await sb.from('fitness_races').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
