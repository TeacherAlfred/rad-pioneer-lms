-- Irene Fitness Challenge — "Tell Your Story" step (Irene_Story_Questions_Spec.md).
-- Additive only: a new step between the live Submission and Confirmation
-- steps, writing to a new table. Does not touch irene_fitness_families/
-- irene_fitness_responses/irene_fitness_children.

create table irene_fitness_response_story (
  response_id uuid primary key references irene_fitness_responses(id) on delete cascade,
  motivation text check (char_length(motivation) <= 150),
  club_member boolean,
  club_names text check (char_length(club_names) <= 100),
  shoe_count smallint check (shoe_count between 0 and 50),
  boss_level_challenge_2026 text check (char_length(boss_level_challenge_2026) <= 150),
  toughest_challenge text check (char_length(toughest_challenge) <= 150),
  proudest_moment text check (char_length(proudest_moment) <= 150),
  weirdest_fuel text check (char_length(weirdest_fuel) <= 150),
  funniest_fail text check (char_length(funniest_fail) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table irene_fitness_response_story enable row level security;
