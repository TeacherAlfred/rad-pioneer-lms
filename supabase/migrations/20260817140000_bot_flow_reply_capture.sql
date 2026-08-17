-- Some bot_flows messages ask an open question (e.g. "reply with your email
-- address") rather than offering buttons. Nothing tracked that a lead was
-- mid-question, so their next freeform reply fell through STAGE 1's normal
-- keyword/catch-all logic and got the generic "Hey, great to hear from
-- you!" welcome instead of being captured - the webinar email flow (and the
-- identically-shaped "Request a call" flow) both had this gap.
--
-- expects_reply marks a flow's message as a question whose next reply
-- should be captured rather than treated as a fresh conversation turn.
-- reply_label names what's being captured ("Email address", "Preferred
-- call time") for the lead_notes row and the admin notification.
-- reply_confirmation is what's sent back once captured; null falls back to
-- a generic "thanks, passed that on" in the webhook.
alter table bot_flows
  add column expects_reply boolean not null default false,
  add column reply_label text,
  add column reply_confirmation text;

-- Denormalized onto the lead (not just a flow_id FK) so capture behavior at
-- reply time is immune to the flow being edited/deleted afterward, and so
-- STAGE 1 doesn't need a join on every inbound text message to check.
-- awaiting_reply_flow_id is kept alongside purely for reporting/audit.
alter table leads
  add column awaiting_reply_flow_id uuid references bot_flows(id) on delete set null,
  add column awaiting_reply_label text,
  add column awaiting_reply_confirmation text;

create index leads_awaiting_reply_flow_id_idx on leads(awaiting_reply_flow_id);

-- Fixes the two flows already live with this exact gap. Wording is a
-- starting point - editable from /admin/bot-flows like anything else here.
update bot_flows set
  expects_reply = true,
  reply_label = 'Email address',
  reply_confirmation = 'Thanks! I''ve passed your email on to the team - the Teams invite is on its way. 🎉'
where trigger_button_id = 'btn_register_webinar';

update bot_flows set
  expects_reply = true,
  reply_label = 'Preferred call time',
  reply_confirmation = 'Got it - I''ve passed your preferred time on to the team, they''ll be in touch to confirm.'
where trigger_button_id = 'btn_call';
