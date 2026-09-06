-- Adds the Meridian ebook reader (reader-v2) to the admin Projects hub as a
-- private, live entry - it existed as a real, shipped app already but was
-- never registered in the projects table (only Irene Fitness was migrated
-- in when the hub moved off the old hardcoded array).
insert into projects (key, name, href, stage, category, status, converted_at)
values ('reader-v2', 'Meridian (Reader v2)', '/projects/reader-v2', 'active', 'private', 'live', now());
