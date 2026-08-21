-- Lead Qualification Model (RAD_Academy_Admin_Dashboard_System_Design_v1.2.md
-- §3.1b) - an ordered, EXTENSIBLE set of qualification checks. One row per
-- lead per stage (not a single Y/N column) so a new stage can be added later
-- without needing to redefine or re-migrate existing checks - past data is
-- simply re-evaluated by asking "does this lead now have a passing row for
-- every currently-defined stage."
--
-- v1.2 §1 also corrects the constraint thresholds to count QUALIFIED leads,
-- not raw leads - this table is what makes that distinction computable at
-- all (previously nothing tracked qualification beyond a free-text comment).

create table lead_qualification_checks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  stage_key text not null,
  passed boolean not null,
  checked_at timestamptz not null default now(),
  checked_by text not null default 'admin',
  notes text,
  unique (lead_id, stage_key)
);

create index lead_qualification_checks_lead_id_idx on lead_qualification_checks (lead_id);

alter table lead_qualification_checks enable row level security;
