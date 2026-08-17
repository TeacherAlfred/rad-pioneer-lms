-- Splits leads.status - which was doing four unrelated jobs at once (what
-- the admin did, where the lead is in the journey, whether they've ever
-- paid, how warm they are right now) - into four independent axes, per
-- RAD_Lead_Stages_and_Followup_Spec.md:
--   lifecycle_stage     - where they're heading toward the next purchase
--   lead_activities      - outcome of each individual contact attempt
--   is_customer           - have they ever paid (never regresses)
--   engagement_recency   - how warm, right now (computed nightly)
-- plus stage_health, a per-stage staleness flag driven by time-in-stage
-- (distinct from engagement_recency, which is driven by last_inbound_at
-- regardless of stage).
--
-- status is kept, not dropped - it becomes a frozen legacy field, unread
-- going forward, so nothing depends on a hard cutover and old reports
-- referencing it don't break.
--
-- needs_human is a deliberate addition NOT in the spec's four axes: it
-- preserves the existing "who needs the admin to reply" pipeline-alert
-- signal without conflating it into lifecycle_stage, which per the spec
-- must never regress (a lead who's reached `offered` shouldn't get pushed
-- back to `qualified` just because they replied needing a human).
--
-- interested_session_id is new capability - no table in this schema links
-- a lead to a specific session pre-payment. A single nullable FK (not a
-- join table) matches this model's "one active journey at a time"
-- assumption; it's set when a lead moves to qualified/offered against a
-- specific session, and persists through a re_nurture auto-move as the
-- "missed session" tag described in the spec.

alter table leads
  add column lifecycle_stage text not null default 'new',
  add column stage_entered_at timestamptz not null default now(),
  add column stage_health text not null default 'active',
  add column is_customer boolean not null default false,
  add column first_purchase_at timestamptz,
  add column last_purchase_at timestamptz,
  add column lifetime_value numeric(10,2),
  add column last_inbound_at timestamptz,
  add column engagement_recency text not null default 'active',
  add column lost_reason text,
  add column needs_human boolean not null default false,
  add column interested_session_id uuid references sessions(id);

create index leads_lifecycle_stage_idx on leads(lifecycle_stage);
create index leads_interested_session_id_idx on leads(interested_session_id);

-- Attempt-level outcome log ("WhatsApp - outcome: no_response"), distinct
-- from the existing `messages` table (full raw transcript). One row per
-- contact attempt, never overwritten - same reasoning as lead_notes.
create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null,
  direction text not null,
  outcome text not null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table lead_activities enable row level security;
create index lead_activities_lead_id_idx on lead_activities(lead_id);

-- lead_status_history already had the shape this needed - just split its
-- single `status` column into from_stage/to_stage and add the audit
-- columns the spec's batch stage editor will need later (changed_by,
-- reason, batch_id). Existing rows and the FK/index survive the rename.
alter table lead_status_history rename to lead_stage_history;
alter table lead_stage_history rename column status to to_stage;
alter table lead_stage_history
  add column from_stage text,
  add column changed_by text,
  add column reason text,
  add column batch_id uuid;

-- Backfill lifecycle_stage from the best available signal in the old
-- status column. needs_human also sets the new needs_human flag, since
-- that operational meaning has no equivalent lifecycle_stage value.
update leads set lifecycle_stage = 'new' where status = 'new_lead';
update leads set lifecycle_stage = 'qualified', needs_human = true where status = 'needs_human';
update leads set lifecycle_stage = 'engaged' where status in ('contacted', 'no_response', 'followup_scheduled');
update leads set lifecycle_stage = 're_nurture', is_customer = true where status = 'converted';
update leads set lifecycle_stage = 'lost', lost_reason = 'migrated_unknown' where status = 'lost';

-- Preserve the contact-outcome history the old status field was silently
-- discarding on every overwrite - one historical lead_activities row per
-- lead currently sitting at one of these three statuses.
insert into lead_activities (lead_id, channel, direction, outcome, created_by, created_at)
select id, 'whatsapp', 'outbound', status, 'migration_backfill', coalesce(contacted_at, created_at)
from leads
where status in ('contacted', 'no_response', 'followup_scheduled');

-- Best available approximation - the true moment each lead entered its
-- current stage isn't recoverable from a single status column.
update leads set stage_entered_at = created_at;

update leads set first_purchase_at = coalesce(contacted_at, created_at), last_purchase_at = coalesce(contacted_at, created_at)
where is_customer = true;

update leads l set last_inbound_at = m.last_inbound
from (
  select lead_id, max(created_at) as last_inbound
  from messages
  where direction = 'inbound'
  group by lead_id
) m
where m.lead_id = l.id;

-- One-time computation of engagement_recency and stage_health using the
-- same thresholds the nightly cron job applies going forward, so no row
-- is left at its bare default immediately after this migration runs.
update leads set engagement_recency = case
  when last_inbound_at is null then 'cold'
  when now() - last_inbound_at <= interval '14 days' then 'active'
  when now() - last_inbound_at <= interval '45 days' then 'cooling'
  when now() - last_inbound_at <= interval '120 days' then 'dormant'
  else 'cold'
end;

update leads set stage_health = case
  when lifecycle_stage in ('won', 'lost', 'opted_out') then 'active'
  when now() - stage_entered_at <= case lifecycle_stage
    when 'new' then interval '3 days'
    when 'engaged' then interval '14 days'
    when 'qualified' then interval '3 days'
    when 'offered' then interval '48 hours'
    when 're_nurture' then interval '90 days'
    else interval '999 days'
  end then 'active'
  when engagement_recency in ('dormant', 'cold') then 'dormant'
  else 'stalled'
end;
