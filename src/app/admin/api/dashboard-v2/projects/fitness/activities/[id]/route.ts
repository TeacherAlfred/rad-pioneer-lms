import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: activity, error } = await sb.from('fitness_activities').select('*').eq('id', id).single();
  if (error || !activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

  const [{ data: gear }, { data: trainingLoad }, { data: bestEfforts }, { data: linkedRace }] = await Promise.all([
    activity.gear_id ? sb.from('fitness_gear').select('id, nickname, brand, model_name').eq('id', activity.gear_id).single() : Promise.resolve({ data: null }),
    sb.from('fitness_training_load_signals').select('*').eq('activity_id', id).maybeSingle(),
    sb.from('fitness_best_efforts').select('name, distance_m, moving_time_s, pr_rank').eq('activity_id', id).order('distance_m', { ascending: true }),
    sb.from('fitness_races').select('id, name').eq('activity_id', id).maybeSingle(),
  ]);

  // Strava's best_efforts mixes metric distances (5K, 10K, Half-Marathon...)
  // with imperial ones (1/2 mile, 1 mile, 2 mile, 10 mile) - this app is
  // km-only throughout, so the imperial entries are dropped here rather
  // than reaching the client at all.
  const metricBestEfforts = (bestEfforts ?? []).filter((be) => !be.name.toLowerCase().includes('mile'));

  return NextResponse.json({
    activity,
    gear: gear ?? null,
    training_load: trainingLoad ?? null,
    best_efforts: metricBestEfforts,
    race: linkedRace ?? null,
  });
}
