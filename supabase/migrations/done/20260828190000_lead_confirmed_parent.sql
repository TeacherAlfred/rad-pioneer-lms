-- Companion flag to is_potential_student (see
-- 20260815155038_lead_notes_and_potential_student.sql): that one marks a
-- lead as the kid themselves, this one marks a lead as a confirmed parent/
-- guardian. Both exist so the Leads Overview's "Uncategorized" tile (leads
-- that are neither) has something to clear against for a lead that hasn't
-- been linked to a specific kids row yet, without requiring an admin to
-- create a kids record just to record "yes, this one's a parent".
alter table leads add column is_confirmed_parent boolean not null default false;
