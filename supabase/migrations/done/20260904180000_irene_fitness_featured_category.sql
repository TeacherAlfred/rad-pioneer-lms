-- The single teaser line shown on every card before "Read full story" is
-- tapped (community/page.tsx's teaserLine) always defaulted to the
-- funniest_fail field, falling back to proudest_moment - not actually a
-- per-category choice, just a hardcoded priority. That default surfaced
-- literal "N/A" text whenever a family typed it into the funny answer.
-- featured_category lets an admin pick which of the 3 categories'
-- (already-override-aware, see category_overrides) excerpt is shown as that
-- one teaser line - null keeps the old default behaviour.
alter table irene_fitness_response_story
  add column featured_category text
    check (featured_category in ('funniest', 'most_inspiring', 'mad_scientist'));
