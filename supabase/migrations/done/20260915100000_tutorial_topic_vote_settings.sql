-- Two admin-configurable thresholds for the topic-voting feature
-- (tutorial_topic_votes): reveal_threshold gates showing ANY vote counts
-- publicly until total votes across every topic reach it (so a brand-new,
-- barely-voted-on list doesn't look empty/unpopular), and
-- min_display_threshold hides a single topic's exact count below that
-- number even once reveal_threshold is met, replacing it with a dash so
-- one quiet topic doesn't look obviously unpopular next to louder ones.
-- Actual masking happens server-side in /api/tutorials/topic-votes - the
-- raw threshold values themselves are only ever read by that route and the
-- admin settings screen, so this stays locked to service-role like every
-- other admin-only config in this feature.
--
-- Single-row settings table (same convention as the per-project singleton
-- config tables elsewhere in this codebase, e.g. irene_fitness_faq_settings) -
-- always exactly one row, updated in place rather than versioned.
create table tutorial_topic_vote_settings (
  id uuid primary key default gen_random_uuid(),
  reveal_threshold integer not null default 10,
  min_display_threshold integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table tutorial_topic_vote_settings enable row level security;

insert into tutorial_topic_vote_settings (reveal_threshold, min_display_threshold) values (10, 3);
