-- Replaces the single flat DND window (dnd_enabled/dnd_start_time/
-- dnd_end_time on admin_notification_settings) with a per-day schedule -
-- the admin needs longer DND on some days (e.g. weekends) than others, or
-- entirely different windows per day rather than one rule for every day.
--
-- One row per day of week (0=Sunday..6=Saturday, matching JS Date.getDay()),
-- seeded here rather than lazily created like admin_notification_settings'
-- single row - a fixed set of exactly 7 rows doesn't need the "create on
-- first read" pattern that made sense for a single implicit-row table.
create table admin_dnd_schedule (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null unique check (day_of_week between 0 and 6),
  enabled boolean not null default false,
  start_time time,
  end_time time,
  updated_at timestamptz not null default now()
);

alter table admin_dnd_schedule enable row level security;

insert into admin_dnd_schedule (day_of_week, enabled)
select generate_series(0, 6), false;

alter table admin_notification_settings
  drop column dnd_enabled,
  drop column dnd_start_time,
  drop column dnd_end_time;
