-- Manual override on top of the live_from/live_until date window
-- (20260821090000_featured_programs.sql): draft = true hides a program
-- from the public site immediately, regardless of what its dates say -
-- for "take this down right now" without touching (or losing) the
-- scheduled dates underneath it. draft = false (the default) is the
-- existing behavior unchanged - purely date-driven.
alter table featured_programs
  add column if not exists draft boolean not null default false;

-- Public read policy now requires BOTH not-draft and inside the date
-- window - either one alone hides the card. Dropped and recreated since
-- policies don't support create-or-replace.
drop policy if exists "featured_programs_public_read" on featured_programs;

create policy "featured_programs_public_read" on featured_programs
  for select
  using (draft = false and live_from <= now() and live_until >= now());
