-- Admin "take over this conversation" controls:
--
-- 1. leads.bot_paused - when set, the webhook (whatsapp-webhook/route.ts)
--    stops ALL automated processing for that lead's inbound messages
--    (opt-out detection, Irene/voucher routing, reply-capture, needs_human
--    nudges, STAGE 1/2) and just logs + alerts the admin immediately, so
--    only a manual reply from /admin/lead-funnel/messages goes out. This
--    is deliberately separate from needs_human, which still sends one
--    automated nudge and is meant to be transient (cleared once handled);
--    bot_paused sends nothing at all and stays set until an admin
--    explicitly turns it back off.
alter table leads
  add column if not exists bot_paused boolean not null default false,
  add column if not exists bot_paused_at timestamptz;

create index if not exists leads_bot_paused_idx on leads(bot_paused) where bot_paused;

-- 2. messages.buttons - the manual reply route
--    (admin/api/lead-funnel/reply) can now send an interactive message
--    with up to 3 buttons whose ids are existing bot_flows.trigger_button_id
--    values, so tapping one re-enters the normal bot_flows path (STAGE 2)
--    exactly like a bot-sent button would. Stored so Message Activity can
--    show what was actually sent, not just the body text.
alter table messages
  add column if not exists buttons jsonb;
