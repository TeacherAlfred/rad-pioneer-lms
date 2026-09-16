-- Lets a bot_flows row's tap (e.g. the confirm button on the opt-out
-- prompt) mark the lead opted_out as a config flag rather than a hardcoded
-- trigger_button_id in the webhook - see runBotFlow's sets_opted_out
-- handling in src/app/api/whatsapp-webhook/route.ts.
alter table bot_flows
  add column if not exists sets_opted_out boolean not null default false;
