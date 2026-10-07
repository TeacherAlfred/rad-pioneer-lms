-- Dashboard v2 rebuild (RAD_Academy_Admin_Dashboard_System_Design_v1.md /
-- RAD_Academy_Business_Systems_Map_v1_1.md) - founder-adjustable constraint
-- thresholds and the landmines tracker. Both tables were assumed by the
-- design docs to already exist ("mostly a structured read of a table that
-- already exists") - confirmed against the live schema that neither did.

create table dashboard_settings (
  id uuid primary key default gen_random_uuid(),
  lead_volume_threshold_per_day integer not null default 10,
  founder_attention_threshold_per_day integer not null default 10,
  active_pipeline_threshold integer not null default 30,
  mrr_hire_cost_multiplier_months integer not null default 3,
  last_security_audit_at timestamptz,
  last_security_audit_note text,
  updated_at timestamptz not null default now()
);

insert into dashboard_settings (lead_volume_threshold_per_day, founder_attention_threshold_per_day, active_pipeline_threshold, mrr_hire_cost_multiplier_months)
values (10, 10, 30, 3);

create table landmines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  system text not null, -- one of the 5 journey stages, or 'admin'
  state text not null default 'ok' check (state in ('ok', 'watch', 'critical')),
  next_action text,
  owner text not null default 'founder' check (owner in ('founder', 'developer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into landmines (title, system, state, next_action, owner) values
  ('Alert Noise', 'admin', 'watch', 'Confirm what''s live vs. designed; finish the switchable digest-mode setting before Polokwane''s 15-seat/day target trips the >10/day threshold.', 'developer'),
  ('Checkout Friction', 'onboarding', 'watch', 'Confirm PayFast state with developer - automated vs. manual-link-only.', 'developer'),
  ('Creative Fatigue', 'lead_generation', 'ok', 'Execute the existing rotation; evaluate the personality quiz as a new angle.', 'founder'),
  ('Holiday Timing', 'lead_generation', 'watch', 'Fold "last free weekend before Term 4" framing into the existing Day 9-10 urgency touches.', 'founder');

alter table dashboard_settings enable row level security;
alter table landmines enable row level security;
