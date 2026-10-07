-- Tasks "God Mode": a single-admin task tracker with subtasks, multi-group
-- tagging, and simple recurring presets (daily/weekdays/weekly/monthly) -
-- the founder's literal first-thing-every-morning check-in.
--
-- One-off and recurring tasks share this table, distinguished by whether
-- recurrence is set. One-off completion is a direct column mutation
-- (completed_at), same lightweight pattern as e.g.
-- irene_fitness_responses.qa_confirmed/qa_confirmed_at. Recurring tasks are
-- never "done" as a row - each occurrence's completion is logged separately
-- in task_completions (append-only, same discipline as
-- dashboard_focus_item_logs) so God Mode can answer "done today?" without a
-- cron materializing daily rows; period-identity math lives entirely in
-- src/lib/dashboard-v2/taskRecurrence.ts, not duplicated in SQL.
--
-- Grouping is a join table (task_task_groups), mirroring the existing
-- dashboard_focus_item_results join table shape, rather than an array
-- column - gets FK integrity and cheap "all tasks in group X" queries.
--
-- Project checklists (project_checklist_items) stay a separate, simpler
-- system - tasks.project_id is only an optional link, no auto-sync.

create table task_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  parent_task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  due_date date,
  -- {type:'daily'} | {type:'weekdays', days:[1,2,3,4,5]} (0=Sun..6=Sat) |
  -- {type:'weekly', day:1} | {type:'monthly', day_of_month:15}.
  -- Simple presets only - no RRULE/cron engine.
  recurrence jsonb,
  completed_at timestamptz, -- one-off tasks only; always null for recurring tasks
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on tasks (project_id);
create index tasks_parent_task_id_idx on tasks (parent_task_id);
create index tasks_due_date_idx on tasks (due_date) where archived = false;
create index tasks_recurrence_idx on tasks using gin (recurrence) where recurrence is not null;

create table task_task_groups (
  task_id uuid not null references tasks(id) on delete cascade,
  group_id uuid not null references task_groups(id) on delete cascade,
  primary key (task_id, group_id)
);

create index task_task_groups_group_id_idx on task_task_groups (group_id);

-- Append-only occurrence log for recurring tasks - the row is the source of
-- truth for "was this period's occurrence done." No period_date column or
-- uniqueness constraint: a task can be logged done more than once per
-- period if desired, and "done for the current period" is computed at read
-- time from the latest log timestamp falling inside the period boundary.
create table task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  note text
);

create index task_completions_task_id_completed_at_idx on task_completions (task_id, completed_at);

alter table task_groups enable row level security;
alter table tasks enable row level security;
alter table task_task_groups enable row level security;
alter table task_completions enable row level security;

-- Systems Status tracking entry for this build.
insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('tasks_god_mode', 'Tasks: God Mode + Recurrence', 'A single flat view of every task regardless of grouping (subtasks, multi-group tags, simple daily/weekdays/weekly/monthly recurrence), meant as the first-thing-every-morning check-in.', 'now', 10)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('tasks_god_mode', 'Schema: tasks / task_groups / task_task_groups / task_completions', 'done', 'Recurring completion is an append-only log, no cron needed.', 1),
  ('tasks_god_mode', 'God Mode all-tasks view with Overdue/Due Today', 'done', null, 2),
  ('tasks_god_mode', 'Subtasks + multi-group tagging', 'done', null, 3),
  ('tasks_god_mode', 'Simple recurrence presets (daily/weekdays/weekly/monthly)', 'done', 'No RRULE/cron engine - four fixed presets only.', 4)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
