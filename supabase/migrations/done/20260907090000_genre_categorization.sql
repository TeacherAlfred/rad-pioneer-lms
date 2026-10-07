-- Genre categorization for rad_books, mirroring the note-tag controlled
-- vocabulary pattern (20260831150000_note_tag_vocabulary.sql) instead of
-- storing raw, noisy Open Library subjects directly. categorization_status
-- is a real column (not buried in a Json field) so the batch job in
-- /api/categorize-genres can cheaply select unprocessed/retryable books.

alter table rad_books
  add column categorization_status text not null default 'pending'
    constraint rad_books_categorization_status_check
    check (categorization_status in ('pending', 'success', 'needs_review', 'failed'));

-- Audit trail: raw fetched subjects + the curated slugs they mapped to, so a
-- future re-mapping (if the curated vocabulary changes) can run off stored
-- data without re-hitting the Open Library API.
alter table rad_books
  add column genre_metadata jsonb null;

-- Widen the note-tag vocabulary's category constraint to also allow 'genre'.
-- Existing whole-book free tags (robotics, edtech, etc.) keep category null,
-- unaffected.
alter table rad_tags drop constraint rad_tags_category_check;
alter table rad_tags add constraint rad_tags_category_check
  check (category in ('domain', 'function', 'genre'));

-- Curated, editable starting point - renaming/adding a category later is a
-- data change here plus a matching edit to src/lib/genre-vocabulary.ts, not a
-- schema change. 'uncategorized' is a real seeded tag assigned whenever
-- subject-mapping produces zero matches, so "genre triage done" is always
-- queryable as "book has >=1 genre-category tag."
insert into rad_tags (name, category) values
  ('business-strategy', 'genre'),
  ('finance-investing', 'genre'),
  ('marketing-sales', 'genre'),
  ('entrepreneurship', 'genre'),
  ('leadership-management', 'genre'),
  ('productivity-habits', 'genre'),
  ('psychology-behavior', 'genre'),
  ('self-help', 'genre'),
  ('biography-memoir', 'genre'),
  ('history', 'genre'),
  ('science-technology', 'genre'),
  ('health-fitness', 'genre'),
  ('politics-current-affairs', 'genre'),
  ('philosophy', 'genre'),
  ('fiction-genre', 'genre'),
  ('fiction-literary', 'genre'),
  ('religion-spirituality', 'genre'),
  ('reference-education', 'genre'),
  ('uncategorized', 'genre')
on conflict (name) do update set category = excluded.category;
