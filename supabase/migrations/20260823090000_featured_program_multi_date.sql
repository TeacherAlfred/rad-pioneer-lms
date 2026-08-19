-- Lets a program with multiple one-off dates (e.g. Polokwane's Sat/Sun
-- circuit) offer a combined "both dates" choice on the registration form,
-- not just one-or-the-other. Admin-controlled per program - a program
-- whose dates are genuinely alternatives (pick one city's session, not
-- both) shouldn't get a nonsensical "both" option.
--
-- No new date-combination data is stored: when this is on, the client
-- synthesizes one extra dropdown option by joining every existing
-- date_options entry's id (with "+") and label (with " + "), and the
-- submit route (src/app/api/register-interest/submit/route.ts) splits
-- that composite id back apart to resolve the label - so this works for
-- any number of dates, not just two, without a new relational structure.
alter table featured_programs
  add column if not exists allow_multi_date boolean not null default false;
