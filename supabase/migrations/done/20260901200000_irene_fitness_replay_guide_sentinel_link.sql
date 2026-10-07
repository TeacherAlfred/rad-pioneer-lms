-- "Replay the guide" was a real URL (?tour=1) rendered through the FAQ's
-- generic link_url field, which always opens in a new tab (correct for the
-- submissions-page link elsewhere, wrong here - replaying is an in-page
-- action, not a trip to another page, and the new tab left the FAQ modal
-- open behind it). Swapped for a sentinel value FaqAccordion recognises
-- (HeaderActions.tsx's REPLAY_TOUR_LINK) and renders as a button that
-- starts the tour directly and closes the FAQ, instead of a real href.
update irene_fitness_faq_items
set link_url = 'irene-fitness://replay-tour',
    updated_at = now()
where question = 'How do I use this page?';
