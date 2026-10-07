-- Extends the existing child_age_fits_program qualification check from a
-- plain pass/fail into a 3-way outcome (fits / too young / too old), and
-- gives "too old" a real destination instead of dead-ending as a lost lead:
-- a tag that marks them for a future young-adults nurture track, plus a
-- last-sent timestamp so the quarterly cron below doesn't re-send too often.

alter table lead_qualification_checks
  add column if not exists detail text;
comment on column lead_qualification_checks.detail is
  'Optional outcome detail for a stage beyond pass/fail. For child_age_fits_program: too_young or too_old.';

alter table leads
  add column if not exists young_adult_last_nurture_sent_at timestamptz;

-- No admin UI for these yet (matches the existing dashboard_settings
-- precedent - e.g. last_security_audit_at/note - editable directly in
-- Supabase until a Settings screen exists). template_name/language must be
-- an already-Meta-approved template; the cron no-ops until template_name
-- is set.
alter table dashboard_settings
  add column if not exists young_adult_template_name text,
  add column if not exists young_adult_template_language text,
  add column if not exists young_adult_template_variable_names text[] not null default '{}'::text[];
