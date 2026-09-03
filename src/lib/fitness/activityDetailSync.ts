import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stravaFetch } from '@/lib/fitness/strava';
import { parseTrainingLoadSignal } from '@/lib/fitness/parseTrainingLoad';
import { normalizeWorkoutType } from '@/lib/fitness/workoutType';
import type { StravaDetailedActivity } from '@/lib/fitness/stravaTypes';

// Shared by both the incremental sync route (fresh activities) and the
// backfill pass (older activities synced before workout_type/splits_metric/
// best_efforts existed) - one activity's detail fetch + all the DB writes
// that come from it, so the two callers can't drift out of sync. Throws on
// a failed Strava fetch (including StravaApiError for 429) - callers handle
// rate-limit detection themselves, same as before this was extracted.
export async function processActivityDetail(
  accessToken: string,
  activityId: number | string
): Promise<{ signalParsed: boolean; bestEffortsCount: number; workoutType: string | null }> {
  const sb = supabaseAdmin();
  const detail = await stravaFetch<StravaDetailedActivity>(`/activities/${activityId}`, accessToken);

  const workoutType = normalizeWorkoutType(detail.sport_type || detail.type, detail.workout_type);

  await sb
    .from('fitness_activities')
    .update({
      description_raw: detail.description ?? null,
      calories: detail.calories ?? null,
      splits_metric: detail.splits_metric ?? null,
      workout_type: workoutType,
    })
    .eq('id', String(activityId));

  let signalParsed = false;
  const parsed = parseTrainingLoadSignal(detail.description);
  if (parsed) {
    const { error } = await sb.from('fitness_training_load_signals').upsert(
      { activity_id: String(activityId), ...parsed, parsed_at: new Date().toISOString() },
      { onConflict: 'activity_id' }
    );
    signalParsed = !error;
  }

  let bestEffortsCount = 0;
  if (detail.best_efforts?.length) {
    const bestEffortRows = detail.best_efforts.map((be) => ({
      id: String(be.id),
      activity_id: String(activityId),
      name: be.name,
      distance_m: be.distance,
      moving_time_s: be.moving_time,
      elapsed_time_s: be.elapsed_time,
      start_local: be.start_date_local,
      pr_rank: be.pr_rank ?? null,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await sb.from('fitness_best_efforts').upsert(bestEffortRows, { onConflict: 'id' });
    if (!error) bestEffortsCount = bestEffortRows.length;
  }

  return { signalParsed, bestEffortsCount, workoutType };
}
