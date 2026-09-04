-- Lets the admin pick which written answer stands in for a category on the
-- public feed/leaderboard when the default field (funniest_fail for
-- "Funny", proudest_moment/motivation for "Inspiring", weirdest_fuel/
-- toughest_challenge for "Craziest Diet") is blank or just says "N/A" -
-- see the Responses admin page's per-response override selects and
-- community/page.tsx's categoryExcerpt/teaserLine, both of which check this
-- before falling back to the default field mapping.
alter table irene_fitness_response_story
  add column category_overrides jsonb not null default '{}'::jsonb;
