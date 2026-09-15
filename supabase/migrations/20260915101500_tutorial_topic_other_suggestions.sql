-- Free-text "Other" suggestions for the topic-voting feature. Unlike
-- tutorial_topic_votes, these are never displayed publicly (each one is
-- one person's own wording, not a shared topic to rank) - they're purely
-- an admin-review queue: if enough people type something similar, the
-- admin promotes it into a real tutorial_topic_suggestions row from
-- /admin/tutorials/topics. Same phone-PII posture as tutorial_topic_votes
-- - zero anon policies, insert only via the service-role
-- /api/tutorials/topic-suggestions route.
create table tutorial_topic_other_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text text not null,
  voter_id text not null,
  phone text
);

alter table tutorial_topic_other_suggestions enable row level security;

create index tutorial_topic_other_suggestions_created_at_idx on tutorial_topic_other_suggestions (created_at);
