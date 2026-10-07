-- Irene Fitness public voting/gallery page shipped (src/app/projects/(public)/
-- irene-fitness/community/page.tsx + api/irene-fitness/{feed,my-votes,vote}) -
-- flip the existing Systems Status row from not_started to done, and queue
-- the remaining layers of Irene_Fit_Fam_Platform_Design_v2.md as new
-- not_started rows so they're tracked outside chat, not just deferred verbally.

update system_checklist_items
set state = 'done',
    notes = 'Public feed live at /projects/irene-fitness/community: anonymous device-scoped voting (one tap per response per category per day), phase-aware (locked/open/standings_only), consent-filtered. Admin "View as Anonymous" now links to it.',
    updated_at = now()
where system_key = 'fulfilment'
  and label = 'Irene Fitness public voting/gallery page';

insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('lead_generation', 'Irene Fit Fam lead-magnet funnel (guide cards + modal + guide page)', 'not_started', 'Design doc v2 §4: three themed guide cards in the feed -> modal -> single consolidated guide page (new tab) -> WhatsApp CTA only at the bottom of that page. Needs guide copy written before it can ship - not started.', 7),
  ('fulfilment', 'Irene Fit Fam reactions/cheer phase + 3-channel results announcement', 'not_started', 'Design doc v2 §5, §8: cheer reaction takes over once the contest phase closes (single interaction type live at a time); results go out via school WhatsApp groups (anchor), a separate non-WABA number to the ~50 opted-in, and a pinned feed post. No schema for this yet on top of irene_fitness_votes/voting_settings.', 8),
  ('post_event_nurture', 'Irene Fit Fam event-spotlight posts (Colour Run, Moonlight Fun Run, etc.)', 'not_started', 'Design doc v2 §11: reuses the same card component with a new content flavour and a light "I''m in / thinking about it" tap. Needs a generalized post_type model - current schema (irene_fitness_responses) is single-purpose for the fitness contest, not a generic posts table. Build when the first real event is ready to post, not speculatively.', 2);
