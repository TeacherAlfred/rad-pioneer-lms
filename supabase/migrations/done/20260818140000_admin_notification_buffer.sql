-- Batches non-urgent admin pipeline alerts (button taps, media downloads,
-- bot_flow fires, reply captures) into one consolidated WhatsApp message
-- per lead instead of pinging the admin on every single action, plus quiet
-- hours that hold back ALL notifications - including the still-immediate
-- ones (new lead, opt-out, delivery failure) - until they end.
--
-- admin_notification_settings is a single implicit row - this app has one
-- admin (ADMIN_PHONE_NUMBER), no multi-user settings model anywhere else.
create table admin_notification_settings (
  id uuid primary key default gen_random_uuid(),
  buffer_minutes integer not null default 10,
  dnd_enabled boolean not null default false,
  dnd_start_time time,
  dnd_end_time time,
  updated_at timestamptz not null default now()
);

alter table admin_notification_settings enable row level security;

-- Append-only, one row per buffered event (not one mutable row per lead) -
-- same convention as lead_activities/lead_stage_history/lead_notes/messages,
-- and avoids a read-modify-write race if two events land for the same lead
-- close together. Deliberately separate from pending_admin_alerts, which
-- exists for a different reason (a send failed because Meta's 24hr session
-- window was closed) - this table exists because the admin chose to delay,
-- even though sending is technically possible right now.
create table admin_notification_buffer (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  event_text text not null,
  created_at timestamptz not null default now(),
  flushed_at timestamptz
);

alter table admin_notification_buffer enable row level security;
create index admin_notification_buffer_lead_id_idx on admin_notification_buffer(lead_id);
create index admin_notification_buffer_pending_idx on admin_notification_buffer(flushed_at) where flushed_at is null;
