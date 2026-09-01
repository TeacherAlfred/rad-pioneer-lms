-- Business-owner request (2026-09-01): everything already submitted needs a
-- real QA pass before it's shown/voteable publicly again - the earlier
-- migration (20260901160000) defaulted qa_confirmed=true to grandfather
-- existing responses in without disruption, but that was only ever meant to
-- avoid breaking a preview mid-build, not to skip review entirely. This is
-- the deliberate follow-up: reset every existing response to pending.
--
-- No public-facing effect at the moment this runs - voting phase is
-- 'locked', so the feed isn't visible to anyone regardless. But once phase
-- moves to 'open' again, only QA-confirmed responses will show (see
-- api/irene-fitness/feed and api/irene-fitness/vote's qa_confirmed gate).
update irene_fitness_responses
set qa_confirmed = false,
    qa_confirmed_at = null;
