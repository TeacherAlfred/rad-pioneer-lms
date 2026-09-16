-- Admin pipeline alerts move from "one consolidated message per lead after
-- a per-lead buffer window" to a single global stats-only digest every
-- buffer_minutes (now defaulting to, and set to, 30) - see
-- src/lib/notificationBuffer.ts. last_digest_sent_at replaces the old
-- per-lead "window start" concept (each buffered row's own created_at) with
-- one global clock, so the cadence holds steady regardless of how bursty
-- events are. New-lead alerts are unaffected - still immediate, unchanged.
alter table admin_notification_settings
  add column if not exists last_digest_sent_at timestamptz,
  alter column buffer_minutes set default 30;

update admin_notification_settings set buffer_minutes = 30;
