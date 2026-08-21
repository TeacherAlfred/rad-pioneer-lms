-- Dedicated registrations-tracking page (/admin/registrations): compare
-- recurring Register Interest events instance-to-instance and month-to-
-- month, which today's single-slot leads.interested_program_id can't do
-- (see 20260821120000_register_interest_form.sql - it's "one active
-- journey at a time", so a lead's earlier registration is overwritten the
-- moment they register for something else).
--
-- Two additions:
--
-- 1. featured_programs.series - an admin-set free-text tag grouping
--    recurring instances that share a format but change topic each time
--    (e.g. "Robotics Webinar" across separate monthly-topic cards).
--    Deliberately explicit rather than inferred from title/location -
--    those aren't reliable enough to group on automatically.
--
-- 2. event_registrations - an append-only log, one row per Register
--    Interest submission, decoupled from leads' current-value slot so
--    history survives a lead's next registration. program_id is a
--    nullable FK (survives program deletion) but title/series/location
--    are snapshotted as plain text at submission time, since a program
--    can be retitled or re-tagged after the fact and historical rows
--    should read as they did when submitted.

alter table featured_programs
  add column series text;

create index featured_programs_series_idx on featured_programs (series) where series is not null;

create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  lead_id uuid not null references leads(id) on delete cascade,
  program_id uuid references featured_programs(id) on delete set null,

  program_title text not null,
  series text,
  location text,

  date_option_id text,
  date_label text,

  number_of_children integer not null,
  preferred_channel text,
  source text
);

alter table event_registrations enable row level security;

create index event_registrations_program_id_idx on event_registrations (program_id);
create index event_registrations_series_idx on event_registrations (series) where series is not null;
create index event_registrations_created_at_idx on event_registrations (created_at);

-- Backfill from leads' current interest snapshot. This only recovers each
-- lead's LATEST registration - anyone who registered for an earlier event
-- and then a different one has that earlier submission's structured data
-- already gone from `leads`, recoverable (if at all) only from the
-- free-text note on their lead_activities row logged at the time.
insert into event_registrations (
  lead_id, program_id, program_title, series, location,
  date_label, number_of_children, preferred_channel, source, created_at
)
select
  l.id, fp.id, fp.title, fp.series, fp.location,
  l.interested_date_label, l.number_of_children, l.preferred_channel, l.source,
  coalesce(l.marketing_consent_at, l.created_at)
from leads l
join featured_programs fp on fp.id = l.interested_program_id
where l.interested_program_id is not null
  and l.number_of_children is not null;
