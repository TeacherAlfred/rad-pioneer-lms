-- Splits "is this card live at all" (draft + live_from/live_until, already
-- existing) from "which public surface(s) does it show on" - a program can
-- now be live but deliberately not listed on one or both surfaces, e.g. a
-- pre-registration-only offer shared via a direct link that shouldn't
-- appear in the public /events listing or the homepage carousel. Default
-- true on both so every existing card keeps behaving exactly as it did
-- before this migration - nothing goes newly-hidden without an admin
-- explicitly turning a flag off.
--
-- Deliberately plain columns, not part of the RLS policy - featured_programs
-- is public marketing content already (see 20260821090000_featured_programs.
-- sql's own comment on why this table gets an anon-readable policy at all),
-- and "locked" here means "not listed", not "access-controlled". The
-- existing draft=false + live-window policy is still what actually gates
-- readability; these two columns are display-routing on top of that, same
-- as is_video/accent/allow_multi_date already are.
alter table featured_programs
  add column show_on_events_page boolean not null default true,
  add column show_on_homepage boolean not null default true;
