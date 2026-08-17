-- Admin-only, optional relationship tag for the parent/guardian on file (mom, dad,
-- uncle, aunt, etc). Not selected by the public voting page's explicit column
-- allowlist, so it's never exposed there.
alter table irene_responses
  add column parent_relationship text;
