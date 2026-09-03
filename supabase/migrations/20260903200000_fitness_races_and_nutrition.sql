-- Race logging, Riegel-based marathon prediction, an ultra (Comrades-style)
-- training-load view, and race nutrition planning - extending the phase 1
-- Strava-sync fitness app (20260903180000).
--
-- Two Strava fields unlock most of this and both come back for free on the
-- per-activity detail call the sync route already makes: best_efforts
-- (Strava's auto-detected fastest 1K/5K/10K/Half-Marathon within a run -
-- the prediction's input) and splits_metric (per-km pacing splits, for the
-- race detail page). workout_type is on the cheaper summary list call and
-- is what makes race auto-detection possible at all.

alter table fitness_activities
  add column workout_type text check (workout_type in ('default', 'race', 'long_run', 'workout') or workout_type is null);

-- Per-activity display data only (race detail page pacing table) - never
-- filtered/sorted/aggregated across activities, so jsonb here is fine.
-- Contrast with fitness_best_efforts below, which genuinely needs
-- cross-activity querying ("best 10K in the last 12 weeks") and so is a
-- real table, not jsonb.
alter table fitness_activities
  add column splits_metric jsonb;

-- The only query shape against workout_type is "race-tagged activities
-- with no fitness_races row yet" (the suggestions feed) - index just that
-- slice rather than the whole low-cardinality column.
create index fitness_activities_workout_type_race_idx on fitness_activities (id) where workout_type = 'race';

create table fitness_best_efforts (
  id text primary key, -- Strava's own best-effort (segment effort) id
  activity_id text not null references fitness_activities(id) on delete cascade,
  name text not null, -- Strava's own label verbatim ('5k','10k','Half-Marathon',...) - matched literally by racePrediction.ts, not renormalized
  distance_m numeric not null,
  moving_time_s integer not null,
  elapsed_time_s integer not null,
  start_local timestamptz not null, -- denormalized from the effort itself so "best effort in the last 12 weeks" never needs a join
  pr_rank integer,
  synced_at timestamptz not null default now()
);

create index fitness_best_efforts_activity_id_idx on fitness_best_efforts (activity_id);
create index fitness_best_efforts_name_start_local_idx on fitness_best_efforts (name, start_local desc);

-- Goal (upcoming) and completed races share one table - no status/stage
-- column. Upcoming-vs-past is a plain date fact derived from race_date at
-- query time, not a decision to record, so it's never stored (can't drift
-- out of sync the way a stored flag could).
create table fitness_races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  race_date date not null,
  distance_m numeric not null,
  -- SET NULL not CASCADE: the race record (times, notes, nutrition plan)
  -- is the durable planning/historical record and must survive even if the
  -- linked Strava activity ever disappears on re-sync.
  activity_id text references fitness_activities(id) on delete set null,
  target_time_s integer,
  -- Stored override, not a live join: defaults from the linked activity's
  -- moving_time_s at create time but can diverge deliberately (official
  -- gun/chip time vs Strava's GPS-derived moving time), and must remain
  -- readable even if activity_id later goes null.
  actual_time_s integer,
  source text not null default 'manual' check (source in ('strava_auto', 'manual')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One race row per Strava activity - prevents a double-click or repeated
-- convert action from creating duplicate race rows off the same activity.
create unique index fitness_races_activity_id_uidx on fitness_races (activity_id) where activity_id is not null;
create index fitness_races_race_date_idx on fitness_races (race_date);

-- 1:1 with fitness_races via race_id as the primary key, same pattern
-- already used by fitness_training_load_signals.activity_id.
create table fitness_race_nutrition (
  race_id uuid primary key references fitness_races(id) on delete cascade,
  plan_carbs_g_per_hr numeric,
  plan_hydration_strategy text,
  plan_gel_brand text,
  plan_caffeine_timing text,
  plan_notes text,
  actual_carbs_g_per_hr numeric,
  actual_hydration_notes text,
  actual_gi_issues text, -- called out separately from actual_notes - a well-known ultra-distance concern, worth always being easy to scan across races
  actual_fueling_rating integer check (actual_fueling_rating between 1 and 5),
  actual_notes text,
  updated_at timestamptz not null default now()
);

alter table fitness_best_efforts enable row level security;
alter table fitness_races enable row level security;
alter table fitness_race_nutrition enable row level security;

insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('fitness_races_and_nutrition', 'Personal Fitness App: Races, Predictions & Nutrition', 'Race logging (Strava auto-detected + manual), Riegel-based marathon time prediction, Comrades-style ultra training-load readiness view, and pre/post-race nutrition planning, extending the existing Strava-sync fitness app.', 'now', 12)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('fitness_races_and_nutrition', 'Schema: fitness_best_efforts / fitness_races / fitness_race_nutrition + fitness_activities.workout_type/splits_metric', 'done', null, 1),
  ('fitness_races_and_nutrition', 'Sync route: capture workout_type, splits_metric, best_efforts', 'not_started', null, 2),
  ('fitness_races_and_nutrition', 'Races page: list (upcoming/past) + Strava-suggested races + manual add', 'not_started', null, 3),
  ('fitness_races_and_nutrition', 'Race detail page: linked activity, splits table', 'not_started', null, 4),
  ('fitness_races_and_nutrition', 'Marathon-distance Riegel time prediction', 'not_started', null, 5),
  ('fitness_races_and_nutrition', 'Ultra (Comrades) training-load/readiness view', 'not_started', null, 6),
  ('fitness_races_and_nutrition', 'Race nutrition plan/actuals editor', 'not_started', null, 7)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
