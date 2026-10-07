-- Personal Fitness Analytics: Strava OAuth integration, phase 1 of a
-- 7-step build order (steps 1-5 only - webhook/cron auto-sync and an
-- AI/MCP agent layer are deferred, tracked as not_started below).
--
-- Single-admin app, so no user_id columns anywhere (unlike a typical
-- multi-tenant fitness tracker) - one row per real-world entity (one
-- activity, one shoe, one day's manual log), not scoped per user.
--
-- fitness_oauth_tokens is modeled as a real table (not a hardcoded env var
-- pair) for future multi-provider extensibility (Garmin, Whoop, etc.) even
-- though exactly one row (provider='strava') is expected today.
--
-- activity_streams (raw GPS/HR time-series) is explicitly deferred to
-- phase 2 - fetch-on-demand only, not stored here yet.

create table fitness_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('strava')),
  athlete_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fitness_gear (
  id text primary key, -- Strava gear id (e.g. 'g12345678'), not a uuid - this is the source system's own id
  type text not null check (type in ('shoes', 'bike')),
  brand text,
  model_name text,
  nickname text,
  total_distance_m numeric not null default 0, -- refreshed from GET /gear/{id} on every sync
  retired boolean not null default false,
  mileage_alert_threshold_m numeric not null default 700000, -- 700km midpoint of the 500-800km normal shoe lifespan range
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fitness_activities (
  id text primary key, -- Strava activity id, not a uuid - upsert target for sync dedup
  sport_type text not null,
  name text not null,
  description_raw text, -- raw Strava description field; myTF.run/Huawei Health commentary lives here unstructured
  start_local timestamptz not null,
  distance_m numeric not null default 0,
  moving_time_s integer not null default 0,
  elapsed_time_s integer not null default 0,
  elevation_gain_m numeric,
  avg_speed numeric,
  max_speed numeric,
  avg_cadence numeric, -- Strava's raw SINGLE-LEG value, never doubled here - see formatCadence() for the display convention
  avg_heart_rate numeric,
  max_heart_rate numeric,
  calories numeric,
  relative_effort integer,
  kudos_count integer not null default 0,
  achievement_count integer not null default 0, -- noisy (route-discovery driven per source data) - captured, not trended
  pr_count integer not null default 0,
  gear_id text references fitness_gear(id) on delete set null,
  source text not null default 'strava',
  synced_at timestamptz not null default now()
);

create index fitness_activities_start_local_idx on fitness_activities (start_local desc);
create index fitness_activities_gear_id_idx on fitness_activities (gear_id);

-- One row per activity whose description_raw successfully parsed - not
-- every activity has myTF.run commentary, so this is a sparse child table
-- rather than nullable columns bolted onto fitness_activities.
create table fitness_training_load_signals (
  activity_id text primary key references fitness_activities(id) on delete cascade,
  source text not null default 'mytf_run',
  mileage_flag text, -- e.g. the emoji/status token, best-effort
  run_health text, -- e.g. 'good and fitness improving'
  injury_risk text check (injury_risk in ('low', 'moderate', 'high') or injury_risk is null),
  acr_percent numeric,
  parsed_at timestamptz not null default now(),
  parser_version integer not null default 1 -- bump when the regex is refined against real data, so old rows can be identified for re-parse
);

create table fitness_manual_logs (
  log_date date primary key,
  weight_kg numeric,
  energy_level integer check (energy_level between 1 and 5),
  sleep_hours numeric,
  soreness_notes text,
  life_event_tag text,
  free_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table fitness_oauth_tokens enable row level security;
alter table fitness_gear enable row level security;
alter table fitness_activities enable row level security;
alter table fitness_training_load_signals enable row level security;
alter table fitness_manual_logs enable row level security;

-- Retarget the existing empty project row onto the real bespoke sub-app.
-- Old auto-generated key replaced with a clean slug matching the fitness_
-- table prefix and the /projects/fitness route segment.
update projects
set key = 'fitness',
    href = '/admin/dashboard-v2/projects/fitness',
    description = 'Personal running analytics from Strava: activity sync, shoe mileage alerts, myTF.run training-load parsing, manual daily logs.',
    status = 'uat'
where id = '57dea1c2-6ad4-4a43-adc9-269979646781';

-- Systems Status tracking entry for this build.
insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('fitness_strava_integration', 'Personal Fitness App: Strava Sync', 'A personal running-analytics dashboard fed by Strava OAuth sync - shoe mileage alerts, myTF.run training-load parsing, and a manual daily log, mirroring the irene-fitness bespoke sub-app pattern.', 'now', 11)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('fitness_strava_integration', 'Schema: fitness_oauth_tokens / fitness_gear / fitness_activities / fitness_training_load_signals / fitness_manual_logs', 'done', null, 1),
  ('fitness_strava_integration', 'Strava OAuth connect flow (authorize/callback, token storage + refresh)', 'done', null, 2),
  ('fitness_strava_integration', 'Manual "Sync Now" activity + gear import', 'done', 'No webhook/cron yet - manual trigger only.', 3),
  ('fitness_strava_integration', 'myTF.run description_raw parser -> fitness_training_load_signals', 'done', 'Regex confirmed against one example string only - flagged for refinement once real synced data is seen.', 4),
  ('fitness_strava_integration', 'Shoe mileage alert widget', 'done', null, 5),
  ('fitness_strava_integration', 'Overview dashboard (stat tiles + recent activity + alerts)', 'done', null, 6),
  ('fitness_strava_integration', 'Manual daily log (weight/energy/sleep/soreness/notes) CRUD', 'done', null, 7),
  ('fitness_strava_integration', 'GPS route maps + activity streams (heart rate / pace / elevation time-series)', 'not_started', 'Deferred to phase 2 - fetch-on-demand from Strava streams API, not stored in phase 1 schema.', 8),
  ('fitness_strava_integration', 'Webhook + cron auto-sync (replace manual Sync Now)', 'not_started', 'Deferred to phase 2 - Strava push subscription + scheduled incremental sync using after/before epoch params.', 9),
  ('fitness_strava_integration', 'AI/MCP agent layer over fitness data', 'not_started', 'Deferred to phase 3 - out of scope for phase 1 entirely.', 10)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
