-- 4 real sessions were created via the UI before the venue_id dropdown
-- existed, with "Menlyn Square Office Park: <maps link>" typed into the
-- old free-text `venue` column. Point them at the actual venues row (added
-- in 20260814141954_venues.sql) so they pick up coordinates/map link
-- rather than staying stuck as plain text.
update sessions
set venue_id = (select id from venues where name = 'Menlyn Square Office Park')
where venue_id is null
  and venue ilike '%Menlyn Square Office Park%';
