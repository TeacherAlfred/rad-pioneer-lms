-- Captures WhatsApp webhook metadata that was previously read past and
-- discarded: reply/reaction linkage (context.forwarded, reaction.message_id),
-- per-conversation billing data (status.pricing, status.conversation.id),
-- and contact identity (contacts[0].profile.name, contacts[0].wa_id,
-- referral.source_type). error_code/error_detail already exist (see
-- 20260908170000_messages_outbox.sql) and are reused as-is for inbound
-- message.errors - no new column needed for that one.
alter table messages
  add column if not exists forwarded boolean,
  add column if not exists reaction_message_id text,
  add column if not exists pricing_category text,
  add column if not exists pricing_billable boolean,
  add column if not exists conversation_id text;

alter table leads
  add column if not exists wa_profile_name text,
  add column if not exists wa_id text,
  add column if not exists ad_source_type text;

create index if not exists messages_reaction_message_id_idx on messages(reaction_message_id);
