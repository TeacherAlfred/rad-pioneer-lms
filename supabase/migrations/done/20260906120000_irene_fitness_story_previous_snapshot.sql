-- Captures what a response's story fields looked like immediately before
-- an edit overwrites them - api/irene-fitness/story/route.ts sets this only
-- the *first* time content changes after being on record (never overwrites
-- an existing snapshot with an intermediate edit, so admin always compares
-- against the last version they actually saw), and it's cleared again once
-- an admin re-confirms (responses/[id]/route.ts). Lets the QA drawer show
-- "before -> after" per field instead of just the new text.
alter table irene_fitness_response_story
  add column previous_snapshot jsonb;
