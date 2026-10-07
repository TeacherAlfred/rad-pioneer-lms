-- Some expects_reply flows need more than "any text counts as the answer" -
-- asking for an email address and accepting "idk maybe later lol" as one is
-- worse than not asking at all. reply_validation names what shape the reply
-- must have ('email' for now - the extraction lives in the webhook, this
-- just flags which flows require it). A reply that doesn't validate skips
-- the normal capture entirely and hands off to a human instead, using
-- reply_invalid_message (falls back to a generic "couldn't quite catch
-- that, team member will be in touch" in the webhook if left blank) -
-- distinct from reply_confirmation, which is only ever sent on a valid
-- capture.
alter table bot_flows
  add column reply_validation text check (reply_validation in ('email')),
  add column reply_invalid_message text;

-- Denormalized onto the lead alongside the other awaiting_reply_* columns,
-- same reasoning as 20260817140000_bot_flow_reply_capture.sql - immune to
-- the flow being edited/deleted between the ask and the answer.
alter table leads
  add column awaiting_reply_validation text,
  add column awaiting_reply_invalid_message text;
