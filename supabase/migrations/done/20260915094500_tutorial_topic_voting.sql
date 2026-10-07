-- Topic-interest voting for the Tutorial Hub: "what should we build next"
-- for the coming-soon slot at the bottom of /tutorials. A visitor can vote
-- for one or many suggested topics (a like-button pattern, togglable) and
-- optionally leave a phone number so RAD can notify them when their pick
-- gets a launch date - phone is voluntary, so it must never gate the vote
-- itself.
--
-- tutorial_topic_suggestions is public marketing content (just topic
-- titles), same posture as tutorial_series - anon-readable scoped to
-- is_hidden = false, admin writes via a service-role route.
create table tutorial_topic_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  sort_order integer not null default 0,
  is_hidden boolean not null default false
);

alter table tutorial_topic_suggestions enable row level security;

create policy "tutorial_topic_suggestions_public_read" on tutorial_topic_suggestions
  for select
  using (is_hidden = false);

create index tutorial_topic_suggestions_sort_order_idx on tutorial_topic_suggestions (sort_order);

-- tutorial_topic_votes carries an optional phone number, so - unlike the
-- suggestions themselves - this gets zero anon policies (same posture as
-- tutorial_visitors). Vote counts and "did this device already vote" are
-- only ever exposed through the aggregating /api/tutorials/topic-votes
-- route, never by letting the anon client query this table directly.
-- voter_id is a random id generated client-side and stored in
-- localStorage (src/lib/tutorialTopicVoter.ts) - not an identity, just
-- enough to make a vote togglable and to stop the same browser voting for
-- the same topic twice.
create table tutorial_topic_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic_id uuid not null references tutorial_topic_suggestions(id) on delete cascade,
  voter_id text not null,
  phone text,
  unique (topic_id, voter_id)
);

alter table tutorial_topic_votes enable row level security;

create index tutorial_topic_votes_topic_idx on tutorial_topic_votes (topic_id);
create index tutorial_topic_votes_voter_idx on tutorial_topic_votes (voter_id);

insert into tutorial_topic_suggestions (title, sort_order) values
  ('Introduction to Scratch', 1),
  ('Introduction to Python', 2),
  ('Introduction to Java', 3),
  ('Introduction to Web Development', 4),
  ('Introduction to App Development', 5),
  ('Practical use of AI', 6),
  ('Introduction to Web', 7);
