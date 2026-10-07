-- A lead whose WhatsApp number is a shared/business line, not a personal
-- one - the bot's automated replies shouldn't go out unreviewed on a number
-- someone else might be watching. See outbound_message_queue (same
-- migration set, 20260910120100) for where a gated send actually lands.
alter table leads
  add column if not exists is_business_number boolean not null default false;
