-- Register Interest's form has always assumed "how many children" -
-- correct for in-person workshops, wrong for something like the online
-- webinar, which a parent might attend alone, or bring a child to, or both.
-- Admin-configurable per program (not hardcoded to a specific title, which
-- would be fragile against a rename and wouldn't cover the next
-- adult-inclusive event) - default false keeps every existing program's
-- copy exactly as it was.
--
-- Deliberately not a rename of leads.number_of_children or a new column
-- there - the underlying headcount is still "how many people to plan for"
-- regardless of wording; only the form copy, consent text, and admin-
-- facing activity notes change when this is on (see RegisterInterestModal.
-- tsx and /api/register-interest/submit).
alter table featured_programs
  add column counts_general_attendees boolean not null default false;
