-- Splits a logged contact into two phases (2026-09-08 request): the
-- immediate "what I did" (channel/objective/note, already captured at log
-- time) and a "what they did" response that isn't always known yet - a
-- WhatsApp invite or email needs time for a reply, unlike a live phone call
-- where the outcome is often already known. outcome now represents ONLY the
-- response half, and is nullable so a fresh log can genuinely have "no
-- response yet" rather than being forced to guess one.
--
-- response_due_at is stamped at log time (created_at + 24h) whenever outcome
-- is left null, giving the nightly cron a due-list to check. When a real
-- response does come in - captured later via a PATCH, one-shot only (see
-- the activities route) - response_recorded_at/response_recorded_by say
-- when and how it was resolved, distinguishing "admin confirmed" from a
-- future automated path.
--
-- needs_response_review is the "flagged, admin has been notified, hasn't
-- confirmed yet" state - deliberately separate from "outcome is still null"
-- (which also covers "still within the 24h window, nothing to flag yet").
-- Nothing here auto-sets outcome on its own - the cron only ever sets this
-- flag and alerts the admin; an actual outcome value is only ever written
-- by a human confirming it (bulk "mark as no response" or capturing the
-- real one), never silently by the system.
alter table lead_activities
  alter column outcome drop not null,
  add column if not exists response_due_at timestamptz,
  add column if not exists response_recorded_at timestamptz,
  add column if not exists response_recorded_by text,
  add column if not exists needs_response_review boolean not null default false;

create index if not exists lead_activities_needs_review_idx on lead_activities(needs_response_review) where needs_response_review;
create index if not exists lead_activities_response_due_idx on lead_activities(response_due_at) where outcome is null;
