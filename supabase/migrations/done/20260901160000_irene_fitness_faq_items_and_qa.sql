-- Irene Fit Fam: admin-editable FAQ (replaces the narrower
-- results_announcement_date/submissions_open fields from
-- 20260901130000 - now that admins can edit any FAQ answer directly,
-- those two single-purpose fields are a redundant second way to edit the
-- same conceptual content) and a per-response QA confirmation flag.

create table irene_fitness_faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  link_url text,
  link_label text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table irene_fitness_faq_items enable row level security;

-- "Opt out" and "ask us" are NOT items in this table on purpose - they're
-- fixed, always-present affordances rendered directly in the FAQ modal
-- shell (see HeaderActions.tsx), so an admin archiving/editing FAQ content
-- can never accidentally remove the one place someone reaches the POPIA
-- opt-out flow, or the contact form.
insert into irene_fitness_faq_items (question, answer, link_url, link_label, sort_order) values
  ('Who can vote, and how many times a day?', 'Anyone can — no account or sign-in needed. You can vote once per category, per entry, per day. It resets every night, so you can vote for your favourites again tomorrow.', null, null, 1),
  ('Is my vote actually anonymous?', E'Yes. We don''t ask who''s voting — just enough to stop the same device voting twice on the same entry on the same day.', null, null, 2),
  ('Can I still submit my own story, or has that closed?', E'Yes — submissions are open. Use the link below to add or update your family''s entry.', '/projects/irene-fitness', 'Go to the submission page', 3),
  ('When are winners announced?', E'We''ll confirm a date soon and share it here and via WhatsApp.', null, null, 4),
  ('Is any child''s information used on the platform?', E'We do not ask for your child''s name. The only thing we ask for is their grade, which is used to work out the class prize and is never displayed publicly.', null, null, 5),
  ('Who''s actually running this — is it the school or RAD Academy?', 'RAD Academy developed, hosts, and runs this platform on behalf of, and at no cost to, Irene Primary School — our way of giving back to the Irene Primary community.', null, null, 6),
  (E'My entry or vote isn''t showing — who do I contact?', 'Message us using the button below and we''ll sort it out, usually within 24 hours.', null, null, 7);

alter table irene_fitness_voting_settings
  drop column results_announcement_date,
  drop column submissions_open;

-- Defaults true so every response already live keeps showing while this
-- ships - only future submits/edits (see submit/route.ts) get set to false,
-- requiring a fresh admin sign-off before they're shown/voteable again.
-- Some responses have typos or too little content to stand on their own in
-- a public feed; this is the gate for that, not a blanket re-review of
-- everything already up.
alter table irene_fitness_responses
  add column qa_confirmed boolean not null default true,
  add column qa_confirmed_at timestamptz;
