-- Distinguishes "brand new, never reviewed" from "was live/approved, then
-- the family edited it" - both currently look identical (qa_confirmed=false)
-- since submit/route.ts always resets qa_confirmed_at to null on every
-- save, destroying the evidence of a prior approval. This column is set
-- only when a response that WAS qa_confirmed=true gets edited, and cleared
-- again once an admin re-confirms it (see responses/[id]/route.ts's PATCH).
alter table irene_fitness_responses
  add column edited_after_approval_at timestamptz;
