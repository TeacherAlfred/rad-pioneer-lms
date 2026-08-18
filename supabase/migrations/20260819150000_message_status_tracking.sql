-- Meta sends delivery/read status (sent -> delivered -> read, or failed)
-- and conversation-window data (which 24hr customer-service window a send
-- billed against, and when it expires) as webhook events - previously
-- discarded entirely (`if (value.statuses) continue;` in
-- whatsapp-webhook/route.ts). wamid lets a later status event get matched
-- back to the specific outbound row it's about; the other four columns
-- hold what that event told us. Going-forward only - existing rows have no
-- wamid on record, so historical sends can't be backfilled with a status.
alter table messages
  add column wamid text,
  add column status text,
  add column status_updated_at timestamptz,
  add column conversation_category text,
  add column conversation_expires_at timestamptz;

create index messages_wamid_idx on messages(wamid);
