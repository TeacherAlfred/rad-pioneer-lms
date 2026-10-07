-- Onboarding addendum (business-advisor review, 2026-09-01): a forced
-- top-of-page tour has a blind spot for shared-link traffic landing
-- mid-feed, and most of the original 6 tour items are already self-evident
-- (labelled/coloured vote buttons, universally-understood FAQ/message
-- icons). Only the filter tabs and cheer-squad strip genuinely need
-- explaining - this is that explanation, as a real FAQ entry so it's
-- reachable both from a dismissible one-time prompt (community/page.tsx)
-- and permanently from the FAQ itself, never lost after one dismissal.
-- sort_order 0 puts it first, ahead of the existing items (1-7).
insert into irene_fitness_faq_items (question, answer, link_url, link_label, sort_order) values
  (
    'How do I use this page?',
    E'Tap All, New to you, or Your favourites at the top of the feed to filter what you see — New to you shows entries you haven''t voted on yet, Your favourites shows the ones you have. The "Also cheering everyone on" row near the top is for families who joined without sharing a story — you can still vote on their entries too.',
    null,
    null,
    0
  );
