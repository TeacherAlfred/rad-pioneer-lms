-- "How do I use this page?" gets a link to replay the popup guide, reusing
-- the same generic link_url/link_label field already built for the
-- submissions-page link on a different FAQ item - no new mechanism needed.
-- ?tour=1 is read by community/page.tsx to auto-start the guide on load.
update irene_fitness_faq_items
set link_url = '/projects/irene-fitness/community?tour=1',
    link_label = 'Replay the guide',
    updated_at = now()
where question = 'How do I use this page?';
