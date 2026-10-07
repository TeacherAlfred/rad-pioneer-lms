-- Backs the "Register Interest" form described in
-- RAD_Academy_SOP_Event_Registration_Forms.md. Two things land here:
--
-- 1. featured_programs.date_options - the admin-configurable date list a
--    card's Register Interest form cascades off (SOP §7). A jsonb array of
--    { id, label, starts_at } rather than a fixed-vs-rolling toggle: a
--    two-entry array (Polokwane/Pretoria) and an eight-entry rolling
--    Online schedule are the same shape, just different lengths, so one
--    representation covers both without the admin UI needing a mode
--    switch.
--
-- 2. New leads columns for the fields this form captures beyond what the
--    WhatsApp/warm-list intake paths already write, plus the state needed
--    to run SOP §3's returning-lead confirmation (rate-limited last-4
--    digits, with an emailed one-time code as fallback - see the "why not
--    WhatsApp OTP" note below). interested_program_id is a single nullable
--    FK, not a join table, mirroring leads.interested_session_id's existing
--    "one active journey at a time" precedent (20260817120000_lead_lifecycle_model.sql).
--
-- WhatsApp OTP (the SOP's stated preferred fallback) is deliberately not
-- implemented: Meta only allows template sends outside a lead's 24h
-- customer-service window, which requires a pre-approved authentication-
-- category template. No such template exists in this codebase's Meta
-- Business config, and creating one needs a Meta review cycle this build
-- can't complete inline. The email code covers the same fallback need
-- since email is already the form's required universal identity key.

alter table featured_programs
  add column date_options jsonb not null default '[]'::jsonb;

alter table leads
  add column preferred_channel text not null default 'whatsapp'
    check (preferred_channel in ('whatsapp', 'email')),
  add column number_of_children integer,
  add column interested_program_id uuid references featured_programs(id),
  add column interested_date_label text,
  add column marketing_consent_at timestamptz,
  add column confirm_fail_count integer not null default 0,
  add column confirm_fail_reset_at timestamptz,
  add column otp_code_hash text,
  add column otp_expires_at timestamptz,
  add column otp_sent_at timestamptz;

-- Case-insensitive email lookup is this form's primary dedup path (SOP §3
-- "one lead, one pipeline" - email is the universal identity key).
create index leads_email_ci_idx on leads (lower(email));
