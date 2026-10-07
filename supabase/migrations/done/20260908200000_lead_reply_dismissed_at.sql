-- Lets an admin dismiss the "Needs Reply" flag on Message Activity when
-- they've actually handled it another way (a call, WhatsApp Desktop, email)
-- without that being a permanent silence - the flag is purely derived from
-- "is the lead's last message still unanswered", so dismissing it just
-- means "don't flag THIS particular inbound message again." The moment a
-- newer inbound message arrives, its timestamp is later than
-- reply_dismissed_at and the flag naturally reappears - no explicit
-- "re-arm" step needed anywhere.
alter table leads
  add column if not exists reply_dismissed_at timestamptz;
