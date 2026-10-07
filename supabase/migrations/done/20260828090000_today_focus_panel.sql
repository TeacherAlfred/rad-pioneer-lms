-- Admin Dashboard Addendum A1 (Today Panel Banner) + the task-tracking model
-- it turned out to depend on. The addendum assumed "data that already exists
-- in §3.1" - it doesn't; nothing in the schema tracked a founder daily/weekly
-- habit checklist before this. This migration builds that model, not just
-- the display layer.
--
-- Design, per the founder's framing (2026-08-24 conversation):
--   Result       = the lagging outcome a constraint-relief sprint is chasing
--                  (e.g. "2 qualified leads/day"), fixed for ~1-2 weeks
--                  before being judged and either kept (items adjusted) or
--                  marked achieved and replaced.
--   Focus Item   = a fixed daily/weekly habit task, a leading indicator that
--                  should - if done consistently - produce the Result within
--                  that window. The item itself does not change day to day
--                  within its active window; only its daily/weekly actual
--                  does.
--   Every item's "achieved" state is computed from a database source of
--   truth, never a self-reported checkbox that can drift from what's true:
--     - 'qualification_checks': reuses the existing lead_qualification_checks
--       table (already the system of record for "conversations reviewed").
--     - 'focus_log': for habits with no existing system of record (network
--       touch, CPL glance, referral asks, warm-list messages, IPS
--       touchpoints), a tap logs a timestamped row - the row itself becomes
--       the source of truth, same append-only-log discipline as lead_notes/
--       lead_status_history elsewhere in this schema, not a UI-only checkbox.

create table dashboard_focus_results (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  constraint_key text check (constraint_key in ('lead_volume', 'founder_attention', 'fulfilment_capacity', 'recurring_revenue_quality')),
  -- How the RESULT itself (not its lagging-indicator items) is measured.
  -- Only 'qualified_leads_per_day' is implemented today (reuses the same
  -- qualified-lead computation as the Home summary route) - add evaluators
  -- as new result types come up, same discipline as focus item metric_key.
  metric_key text,
  target_value numeric,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  started_at date not null default current_date,
  cycle_days integer not null default 14,
  achieved_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dashboard_focus_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  metric_key text not null check (metric_key in ('focus_log', 'qualification_checks')),
  target_value numeric not null,
  -- Optional upper bound for range targets (e.g. "3-5 referral asks") -
  -- achieved is always actual >= target_value; target_max is display-only.
  target_max numeric,
  active_from date not null default current_date,
  active_until date not null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dashboard_focus_items_active_idx on dashboard_focus_items (status, active_from, active_until);

-- An item can ladder up to one or two results (per the founder's framing) -
-- join table rather than a single FK.
create table dashboard_focus_item_results (
  item_id uuid not null references dashboard_focus_items(id) on delete cascade,
  result_id uuid not null references dashboard_focus_results(id) on delete cascade,
  primary key (item_id, result_id)
);

-- Append-only tap-to-log event log for 'focus_log' items - see file header.
create table dashboard_focus_item_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references dashboard_focus_items(id) on delete cascade,
  logged_at timestamptz not null default now(),
  logged_by text not null default 'admin',
  note text
);

create index dashboard_focus_item_logs_item_id_idx on dashboard_focus_item_logs (item_id, logged_at);

alter table dashboard_focus_results enable row level security;
alter table dashboard_focus_items enable row level security;
alter table dashboard_focus_item_results enable row level security;
alter table dashboard_focus_item_logs enable row level security;

-- Sprint 1 seed - the founder's actual current cycle (2026-08-24 conversation).
do $$
declare
  r_lead_volume uuid;
  i_network_touch uuid;
  i_cpl_glance uuid;
  i_ips_touchpoint uuid;
  i_referral_asks uuid;
  i_warm_list uuid;
  i_conversations_reviewed uuid;
  active_until date := current_date + 13; -- 2-week window, per the founder's stated cadence
begin
  insert into dashboard_focus_results (title, constraint_key, metric_key, target_value, cadence, started_at, cycle_days)
  values ('Lead volume — 2 qualified leads/day (Sprint 1)', 'lead_volume', 'qualified_leads_per_day', 2, 'daily', current_date, 14)
  returning id into r_lead_volume;

  insert into dashboard_focus_items (label, cadence, metric_key, target_value, active_until, sort_order) values
    ('Network touch', 'daily', 'focus_log', 1, active_until, 0) returning id into i_network_touch;
  insert into dashboard_focus_items (label, cadence, metric_key, target_value, active_until, sort_order) values
    ('CPL glance', 'daily', 'focus_log', 1, active_until, 1) returning id into i_cpl_glance;

  insert into dashboard_focus_items (label, cadence, metric_key, target_value, active_until, sort_order) values
    ('IPS touchpoint (Irene Primary School)', 'weekly', 'focus_log', 1, active_until, 0) returning id into i_ips_touchpoint;
  insert into dashboard_focus_items (label, cadence, metric_key, target_value, target_max, active_until, sort_order) values
    ('Referral asks', 'weekly', 'focus_log', 3, 5, active_until, 1) returning id into i_referral_asks;
  insert into dashboard_focus_items (label, cadence, metric_key, target_value, active_until, sort_order) values
    ('Warm-list notes/messages', 'weekly', 'focus_log', 5, active_until, 2) returning id into i_warm_list;
  insert into dashboard_focus_items (label, cadence, metric_key, target_value, active_until, sort_order) values
    -- Auto-derived: already the system of record for lead review (§3.1b),
    -- no separate tap-to-log needed for this one.
    ('Conversations reviewed', 'weekly', 'qualification_checks', 10, active_until, 3) returning id into i_conversations_reviewed;

  insert into dashboard_focus_item_results (item_id, result_id) values
    (i_network_touch, r_lead_volume),
    (i_cpl_glance, r_lead_volume),
    (i_ips_touchpoint, r_lead_volume),
    (i_referral_asks, r_lead_volume),
    (i_warm_list, r_lead_volume),
    (i_conversations_reviewed, r_lead_volume);
end $$;

-- Systems Status tracking entry for this build.
insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('today_focus_panel', 'Today Panel Banner & Focus Tracker', 'A persistent banner across the admin dashboard showing progress against a fixed 1-2 week set of lagging-indicator habits tied to the current constraint''s target result, with a state-triggered (not scheduled) glow when behind pace.', 'now', 8)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('today_focus_panel', 'Data model: focus_results / focus_items / item_results / item_logs', 'done', 'Append-only log discipline for tap-to-log items, same pattern as lead_notes.', 1),
  ('today_focus_panel', 'Evaluators (qualification_checks auto-derived, focus_log tap-to-log)', 'done', 'SAST-correct day/week boundaries (fixed +2h, no DST in SA).', 2),
  ('today_focus_panel', '/today API + log/items/results management endpoints', 'done', null, 3),
  ('today_focus_panel', 'Banner + expand panel UI on all 5 dashboard-v2 screens', 'done', 'Full Today panel on Home below the existing Constraint Banner; compact ConstraintPill + banner on the other 4 screens.', 4),
  ('today_focus_panel', 'First-open-of-day auto-expand, state-triggered glow rule', 'done', 'localStorage date-gate; glow never fires on a fixed timer, only behind-pace/streak-risk/day-end-open.', 5),
  ('today_focus_panel', 'Sprint 1 seed: lead-volume result + 6 founder habit items', 'done', 'Network touch, CPL glance, IPS touchpoint, referral asks, warm-list messages, conversations reviewed — 2-week window from 2026-08-24.', 6),
  ('today_focus_panel', 'Meta Ads auto-sync so CPL Glance can show a real number', 'not_started', 'Blocked on design doc §3.1''s campaign_metrics table (tiered backlog item, not required for this to work) - CPL glance is a tap-to-log habit until then, not an auto-derived number.', 7)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
