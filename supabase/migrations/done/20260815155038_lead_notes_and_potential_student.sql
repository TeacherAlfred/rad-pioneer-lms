-- Lead notes (running log of interactions - calls, WhatsApp exchanges,
-- feedback) and a "potential student" flag for the case where the lead
-- messaging in is themselves within RAD's student age range, not a
-- parent enquiring on a child's behalf.
--
-- is_potential_student deliberately does NOT create a kids row. The
-- consent/enrolment flow requires a guardian (POPIA: a minor can't
-- consent to their own medical/photo permissions - see
-- RAD_Consent_and_Medical_Form_Spec.md), and this lead has no guardian
-- on record. It's a qualification flag for follow-up, not a Student
-- record - a real kids row (and the guardian conversation that goes
-- with it) comes later if this lead converts.
alter table leads add column is_potential_student boolean not null default false;

-- One row per note, never overwritten - "feedback from interactions"
-- implies a running log over time, same reasoning as lead_status_history.
create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by text
);

alter table lead_notes enable row level security;
create index lead_notes_lead_id_idx on lead_notes(lead_id);
