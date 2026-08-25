-- Library-preview aid only, not authoritative: the real apportionment basis
-- for a live quote is each featured_program's own expected_attendee_count
-- (shared across every package attached there - spec §5, "flat costs shared
-- across packages at the same event"). Without something to divide flat
-- items by, the Pricing Library's cost preview could only show flat items
-- as an unapportioned lump sum, which reads as "assumes 1 attendee." This
-- gives that preview a real number to divide by; it is never sent to
-- event_packages or used in the actual per-program rollup.
alter table packages
  add column recommended_min_attendance integer;
