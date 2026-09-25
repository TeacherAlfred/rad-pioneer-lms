-- Stop requests take effect immediately, before the confirmation step.
--
-- Until now tapping "Stop Promotions" (or texting "stop") only sent an
-- "are you sure?" prompt; opted_out flipped only if the lead then tapped
-- "Yes, Stop". Someone who tapped Stop and never answered kept receiving
-- messages. Now the tap itself sets opted_out, and this column records
-- where the lead is in the confirmation step so an admin can review it:
--   pending   - asked to stop, hasn't answered the confirm/cancel prompt
--   confirmed - tapped "Yes, Stop" (or was opted out by an admin)
--   cancelled - tapped "No, Stay Subscribed" (opted_out is back to false)
-- null = never asked. opted_out stays the single flag every send gate reads.
alter table leads
  add column if not exists opt_out_state text
    check (opt_out_state in ('pending', 'confirmed', 'cancelled'));

-- Which step of the opt-out conversation a bot flow is, so the webhook can
-- apply the right state without hardcoding button ids (same config-driven
-- approach as sets_opted_out). The confirm step keeps using sets_opted_out.
alter table bot_flows
  add column if not exists opt_out_step text
    check (opt_out_step in ('request', 'cancel'));

update bot_flows set opt_out_step = 'request'
where trigger_button_id in ('Stop Receiving messages', 'Stop Receiving Messages');

update bot_flows set opt_out_step = 'cancel'
where trigger_button_id = 'btn_optout_cancel';

-- Opt-outs are reviewed as a flag on the contact (Lead Funnel, Message
-- Activity) instead of pinging the admin: an alert on the tap described
-- "Stop Promotions" but not the outcome, e.g. a lead who tapped Stop and then
-- "No, Stay Subscribed" seconds later.
update bot_flows set notify_admin = false, notify_admin_immediate = false
where trigger_button_id in ('Stop Receiving messages', 'Stop Receiving Messages', 'btn_optout_confirm', 'btn_optout_cancel');

-- Existing opt-outs were all confirmed ones.
update leads set opt_out_state = 'confirmed'
where opted_out = true and opt_out_state is null;

-- Known cases from the message log (2026-09-25 review):
--  * *6188 tapped Stop Promotions and never answered the prompt.
update leads
set opted_out = true, opted_out_at = coalesce(opted_out_at, now()), opt_out_state = 'pending'
where phone = '27832756188' and opted_out = false and merged_into_id is null;
--  * *3779 tapped Stop, then "No, Stay Subscribed" - stays subscribed.
update leads set opt_out_state = 'cancelled'
where phone = '27769413779' and opted_out = false and opt_out_state is null;
