-- The Constraint Actions Module (RAD_Academy_Admin_Dashboard_System_Design_
-- v1.2.md §3.1a) - deliberately generic, not hardcoded to any one system.
-- Rows are scoped to a constraint_state so that when the constraint moves
-- (§1), the founder just adds a new set of action rows for the new state -
-- the module itself (schema + UI) never gets rebuilt, only which rows are
-- currently visible changes. Target/actual are founder-adjustable, same
-- "founder-adjustable, not hardcoded" discipline as dashboard_settings/
-- landmines/systems_status.

create table constraint_actions (
  id uuid primary key default gen_random_uuid(),
  constraint_state text not null check (constraint_state in ('lead_volume', 'founder_attention', 'fulfilment_capacity', 'recurring_revenue_quality')),
  label text not null,
  target numeric,
  actual numeric not null default 0,
  unit text,
  period_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index constraint_actions_state_idx on constraint_actions (constraint_state);

alter table constraint_actions enable row level security;
