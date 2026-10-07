-- Holds an automated send that was intercepted because the lead is flagged
-- leads.is_business_number (see src/lib/leadSend.ts's sendToLead()) -
-- instead of actually going out, it lands here for an admin to approve or
-- reject by hand from /admin/lead-funnel/outbox. send_payload carries
-- everything needed to actually perform the send later (approve), in the
-- same shape sendToLead() was called with - either a freeform WhatsApp API
-- payload or a template call's arguments.
create table outbound_message_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  phone text not null,
  label text not null,
  kind text not null check (kind in ('freeform', 'template')),
  send_payload jsonb not null,
  preview_text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table outbound_message_queue enable row level security;
create index outbound_message_queue_lead_id_idx on outbound_message_queue(lead_id);
create index outbound_message_queue_pending_idx on outbound_message_queue(status) where status = 'pending';
