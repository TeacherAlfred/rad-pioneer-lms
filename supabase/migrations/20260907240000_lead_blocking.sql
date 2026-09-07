-- Block abusive/gibberish contacts (RAD_Lead_Contact_Log follow-up,
-- 2026-09-07): distinct from `opted_out`, which only means "stop sending me
-- marketing" and still gets a normal bot reply per the webhook's own comment
-- at the STOP-keyword handler - reusing it here would conflate a POPIA
-- consent withdrawal with a moderation action. is_blocked is a hard stop the
-- webhook checks immediately after resolving the lead, before any bot logic,
-- admin notification, or stage/recency update runs - so a blocked number
-- can't keep pinging the admin, can't warm back up into the call queue's
-- urgency signals, and never re-triggers a "brand new lead" alert.
alter table leads
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;

-- Partial index - only ever queried as "give me the blocked ones", a tiny
-- fraction of the table.
create index if not exists leads_is_blocked_idx on leads(is_blocked) where is_blocked;
