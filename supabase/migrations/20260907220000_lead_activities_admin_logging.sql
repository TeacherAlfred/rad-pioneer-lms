-- Admin-authored contact logging (RAD_Lead_Contact_Log request, 2026-09-07).
-- lead_activities already had the shape a manual "who I called today, what
-- happened" log needs (lead_id, channel, outcome, note, created_by,
-- created_at) - it was just write-only from the WhatsApp webhook, with the
-- admin side (src/app/admin/api/lead-funnel/activities/route.ts) GET-only.
-- This adds the one missing column for the admin flow's "what was this
-- contact for" field. channel/outcome/objective stay free text at the DB
-- level, same as they already were - the admin POST endpoint enforces a
-- fixed vocabulary in code (src/lib/contactLog.ts), while the webhook's
-- existing rows (outcome values like 'contacted'/'no_response') and its own
-- writes keep working untouched since there's no CHECK constraint to break.
alter table lead_activities
  add column if not exists objective text;
