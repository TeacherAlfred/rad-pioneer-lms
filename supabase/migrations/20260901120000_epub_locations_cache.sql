-- Caches epub.js's generated locations map (a JSON string of CFIs at fixed
-- character intervals) so percentage-accurate EPUB progress doesn't require
-- re-walking the entire book's text on every open. Generated once, lazily,
-- on first open of a book that doesn't have it yet.
alter table rad_books add column epub_locations text null;
