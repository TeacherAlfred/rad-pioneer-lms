import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getValidAccessToken, stravaFetch, StravaNotConnectedError, StravaApiError } from '@/lib/fitness/strava';
import { normalizeWorkoutType, RUN_SPORT_TYPES } from '@/lib/fitness/workoutType';
import { processActivityDetail } from '@/lib/fitness/activityDetailSync';
import type { StravaSummaryActivity, StravaGear } from '@/lib/fitness/stravaTypes';

// Strava's list endpoint (/athlete/activities) returns "summary" activities
// - it does NOT include `description`, `calories`, `splits_metric`, or
// `best_efforts`. Those only come back from the per-activity detail
// endpoint (/activities/{id}). `workout_type` (used for race auto-detection)
// IS on the summary list, so it's captured in the cheaper first pass and
// survives even if the sync gets rate-limited before the detail pass runs.
// So this route:
//   1. pages the summary list (only activities since the last sync),
//   2. resolves/upserts gear first (fitness_activities.gear_id is a FK into
//      fitness_gear, so gear rows must exist before activities can point at
//      them - any gear id that fails to resolve just falls back to null on
//      the activity instead of blocking the sync),
//   3. upserts activities (incl. workout_type from the summary),
//   4. does a per-activity detail fetch for description_raw/calories/
//      splits_metric/best_efforts and runs the training-load parser,
//   5. backfills a batch of OLDER run activities that were synced before
//      this feature existed (their workout_type/splits_metric/best_efforts
//      were never captured, since step 1's `after` cursor only looks
//      forward from the last sync - see BACKFILL_BATCH_SIZE below).

const PER_PAGE = 100;
const BACKFILL_BATCH_SIZE = 40; // per click, to stay well under Strava's rate limit alongside the incremental passes above; ordered newest-first so the ~12-week prediction window fills in within 1-2 syncs even though full-history backfill takes many

export async function POST() {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (err) {
    if (err instanceof StravaNotConnectedError) {
      return NextResponse.json({ error: 'Strava is not connected.' }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to get Strava access token' }, { status: 500 });
  }

  const sb = supabaseAdmin();

  const { data: latest } = await sb
    .from('fitness_activities')
    .select('start_local')
    .order('start_local', { ascending: false })
    .limit(1)
    .maybeSingle();

  const after = latest?.start_local
    ? Math.floor(new Date(latest.start_local).getTime() / 1000) - 24 * 60 * 60 // 1-day overlap buffer
    : undefined;

  // ---- Pass 1: paginate the summary list ----
  const summaries: StravaSummaryActivity[] = [];
  try {
    for (let page = 1; ; page++) {
      const params: Record<string, string | number> = { page, per_page: PER_PAGE };
      if (after) params.after = after;
      const batch = await stravaFetch<StravaSummaryActivity[]>('/athlete/activities', accessToken, params);
      summaries.push(...batch);
      if (batch.length < PER_PAGE) break;
    }
  } catch (err) {
    if (err instanceof StravaApiError && err.status === 429) {
      return NextResponse.json(
        { error: 'Strava rate limit hit before any activities were fetched — safe to retry shortly.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Strava sync failed' }, { status: 500 });
  }

  // ---- Pass 2: gear refresh — MUST happen before activities are upserted,
  // since fitness_activities.gear_id is a foreign key into fitness_gear.
  // Every gear id an activity references has to exist in fitness_gear
  // first, or the upsert below violates the FK constraint.
  const gearIds = Array.from(new Set(summaries.map((a) => a.gear_id).filter((g): g is string => !!g)));
  const { data: existingGear } = gearIds.length
    ? await sb.from('fitness_gear').select('id').in('id', gearIds)
    : { data: [] as { id: string }[] };
  const knownGearIds = new Set((existingGear ?? []).map((g) => g.id));

  let gearRefreshed = 0;
  let rateLimited = false;
  for (const gearId of gearIds) {
    try {
      const gear = await stravaFetch<StravaGear>(`/gear/${gearId}`, accessToken);
      const { error } = await sb.from('fitness_gear').upsert(
        {
          id: gear.id,
          type: gear.id.startsWith('b') ? 'bike' : 'shoes',
          brand: gear.brand_name,
          model_name: gear.model_name,
          nickname: gear.name,
          total_distance_m: gear.distance ?? 0,
          retired: !!gear.retired,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (!error) {
        gearRefreshed++;
        knownGearIds.add(gearId);
      }
    } catch (err) {
      if (err instanceof StravaApiError && err.status === 429) {
        rateLimited = true;
        break;
      }
      // Non-rate-limit gear errors are non-fatal - that gear id just stays
      // unknown, so any activity referencing it falls back to gear_id: null
      // below rather than blocking the whole sync on one flaky shoe lookup.
    }
  }

  if (summaries.length > 0) {
    const rows = summaries.map((a) => ({
      id: String(a.id),
      sport_type: a.sport_type || a.type,
      name: a.name,
      start_local: a.start_date_local,
      distance_m: a.distance ?? 0,
      moving_time_s: a.moving_time ?? 0,
      elapsed_time_s: a.elapsed_time ?? 0,
      elevation_gain_m: a.total_elevation_gain,
      avg_speed: a.average_speed,
      max_speed: a.max_speed,
      avg_cadence: a.average_cadence,
      avg_heart_rate: a.average_heartrate,
      max_heart_rate: a.max_heartrate,
      relative_effort: a.suffer_score,
      kudos_count: a.kudos_count ?? 0,
      achievement_count: a.achievement_count ?? 0,
      pr_count: a.pr_count ?? 0,
      // Fall back to null for any gear id we couldn't resolve above (e.g.
      // rate-limited mid gear-pass) instead of violating the FK constraint.
      gear_id: a.gear_id && knownGearIds.has(a.gear_id) ? a.gear_id : null,
      workout_type: normalizeWorkoutType(a.sport_type || a.type, a.workout_type),
      source: 'strava',
      synced_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await sb.from('fitness_activities').upsert(rows, { onConflict: 'id' });
    if (upsertError) {
      return NextResponse.json({ error: `Failed to save activities: ${upsertError.message}` }, { status: 500 });
    }
  }

  // ---- Pass 3: per-activity detail fetch for description_raw/calories/
  // splits_metric/best_efforts + parser. best_efforts is a child table of
  // fitness_activities, same FK-safety reasoning as fitness_training_load_
  // signals: this loop only iterates `summaries`, all of which were already
  // upserted as one batch into fitness_activities above (with an early
  // return on failure), so the parent row always exists before this runs.
  let signalsParsed = 0;
  let detailsFetched = 0;
  let bestEffortsSynced = 0;
  if (!rateLimited) {
    for (const a of summaries) {
      try {
        const result = await processActivityDetail(accessToken, a.id);
        detailsFetched++;
        if (result.signalParsed) signalsParsed++;
        bestEffortsSynced += result.bestEffortsCount;
      } catch (err) {
        if (err instanceof StravaApiError && err.status === 429) {
          rateLimited = true;
          break;
        }
        // Non-rate-limit detail errors are non-fatal - that activity just keeps its summary-only data.
      }
    }
  }

  // ---- Pass 4: backfill older run activities synced before workout_type/
  // splits_metric/best_efforts existed. The list pass above only ever looks
  // forward from the last sync, so these would otherwise never get the new
  // fields. Ordered newest-first so the prediction's 12-week window fills in
  // fast even though a full historical backfill takes many syncs.
  let backfilled = 0;
  let backfillRemaining = 0;
  if (!rateLimited) {
    const { data: needsBackfill } = await sb
      .from('fitness_activities')
      .select('id')
      .in('sport_type', Array.from(RUN_SPORT_TYPES))
      .is('workout_type', null)
      .order('start_local', { ascending: false })
      .limit(BACKFILL_BATCH_SIZE);

    for (const a of needsBackfill ?? []) {
      try {
        await processActivityDetail(accessToken, a.id);
        backfilled++;
      } catch (err) {
        if (err instanceof StravaApiError && err.status === 429) {
          rateLimited = true;
          break;
        }
        // Non-rate-limit errors here are non-fatal too - that activity stays
        // in the backfill queue and gets retried on the next sync.
      }
    }

    if (!rateLimited) {
      const { count } = await sb
        .from('fitness_activities')
        .select('id', { count: 'exact', head: true })
        .in('sport_type', Array.from(RUN_SPORT_TYPES))
        .is('workout_type', null);
      backfillRemaining = count ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    activities_synced: summaries.length,
    gear_refreshed: gearRefreshed,
    details_fetched: detailsFetched,
    signals_parsed: signalsParsed,
    best_efforts_synced: bestEffortsSynced,
    backfilled,
    backfill_remaining: backfillRemaining,
    synced_through: summaries[0]?.start_date_local ?? latest?.start_local ?? null,
    ...(rateLimited
      ? { warning: 'Strava rate limit hit partway through — activity list is up to date, but some gear/details/backfill may be incomplete. Safe to click Sync Now again shortly.' }
      : backfillRemaining > 0
        ? { warning: `Backfilled ${backfilled} older activities' race data — ${backfillRemaining} still to go. Click Sync Now again to continue.` }
        : {}),
  });
}
