-- Weekly dialing target for the Call Queue dashboard cards. One row per
-- Monday-starting work week (Africa/Johannesburg) - set once at the start
-- of the week, editable if it needs correcting, never auto-reset mid-week.
-- Kept as its own tiny table rather than a generic settings blob since it's
-- genuinely time-series (a new row every week, history preserved).
create table call_queue_weekly_targets (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  target int not null check (target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table call_queue_weekly_targets enable row level security;
