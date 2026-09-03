import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getValidAccessToken, stravaFetch, StravaNotConnectedError, StravaApiError } from '@/lib/fitness/strava';
import { parseTrainingLoadSignal } from '@/lib/fitness/parseTrainingLoad';

// Strava's list endpoint (/athlete/activities) returns "summary" activities
// - it does NOT include `description` or `calories`. Those two fields (the
// ones the myTF.run training-load parser actually needs) only come back
// from the per-activity detail endpoint (/activities/{id}). So this route:
//   1. pages the summary list,
//   2. resolves/upserts gear first (fitness_activities.gear_id is a FK into
//      fitness_gear, so gear rows must exist before activities can point at
//      them - any gear id that fails to resolve just falls back to null on
//      the activity instead of blocking the sync),
//   3. upserts activities,
//   4. does a per-activity detail fetch for description_raw/calories and
//      runs the training-load parser.

type StravaSummaryActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number | null;
  average_speed: number | null;
  max_speed: number | null;
  average_cadence: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  suffer_score: number | null;
  kudos_count: number | null;
  achievement_count: number | null;
  pr_count: number | null;
  gear_id: string | null;
};

type StravaDetailedActivity = StravaSummaryActivity & {
  description: string | null;
  calories: number | null;
};

type StravaGear = {
  id: string;
  brand_name: string | null;
  model_name: string | null;
  name: string | null;
  distance: number;
  retired: boolean;
};

const PER_PAGE = 100;

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
      source: 'strava',
      synced_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await sb.from('fitness_activities').upsert(rows, { onConflict: 'id' });
    if (upsertError) {
      return NextResponse.json({ error: `Failed to save activities: ${upsertError.message}` }, { status: 500 });
    }
  }

  // ---- Pass 3: per-activity detail fetch for description_raw/calories + parser ----
  let signalsParsed = 0;
  let detailsFetched = 0;
  if (!rateLimited) {
    for (const a of summaries) {
      try {
        const detail = await stravaFetch<StravaDetailedActivity>(`/activities/${a.id}`, accessToken);
        detailsFetched++;
        await sb
          .from('fitness_activities')
          .update({ description_raw: detail.description ?? null, calories: detail.calories ?? null })
          .eq('id', String(a.id));

        const parsed = parseTrainingLoadSignal(detail.description);
        if (parsed) {
          const { error } = await sb.from('fitness_training_load_signals').upsert(
            {
              activity_id: String(a.id),
              ...parsed,
              parsed_at: new Date().toISOString(),
            },
            { onConflict: 'activity_id' }
          );
          if (!error) signalsParsed++;
        }
      } catch (err) {
        if (err instanceof StravaApiError && err.status === 429) {
          rateLimited = true;
          break;
        }
        // Non-rate-limit detail errors are non-fatal - that activity just keeps its summary-only data.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    activities_synced: summaries.length,
    gear_refreshed: gearRefreshed,
    details_fetched: detailsFetched,
    signals_parsed: signalsParsed,
    synced_through: summaries[0]?.start_date_local ?? latest?.start_local ?? null,
    ...(rateLimited
      ? { warning: 'Strava rate limit hit partway through — activity list is up to date, but some gear/details may be incomplete. Safe to click Sync Now again shortly.' }
      : {}),
  });
}
