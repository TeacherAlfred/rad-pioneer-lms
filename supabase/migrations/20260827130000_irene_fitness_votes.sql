-- Irene Fitness voting: anonymous, category-based, resets daily.
-- Not a single "top pick" — think Facebook likes, where each (response,
-- category) pair is its own "post": a device can like it once, and the like
-- is available again the next day. Three fixed categories, flat 1 vote each
-- (no weighting tier, unlike the old irene-comrades platform).
create table irene_fitness_votes (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references irene_fitness_responses(id) on delete cascade,
  category text not null check (category in ('funniest', 'most_inspiring', 'mad_scientist')),
  voter_device_id text not null,
  vote_date date not null default ((now() at time zone 'Africa/Johannesburg')::date),
  created_at timestamptz not null default now(),
  constraint irene_fitness_votes_one_per_device_per_day unique (response_id, category, voter_device_id, vote_date)
);

create index irene_fitness_votes_response_id_idx on irene_fitness_votes(response_id);
create index irene_fitness_votes_category_idx on irene_fitness_votes(category);

alter table irene_fitness_votes enable row level security;

-- Single-row settings for the (not-yet-built) public voting page: whether
-- it's locked (nothing visible), open for voting, or closed with the
-- existing standings still visible. Admin-controlled toggle, mirrors the
-- phase-control pattern from the old irene-comrades platform.
create table irene_fitness_voting_settings (
  id int primary key default 1 check (id = 1),
  phase text not null default 'locked' check (phase in ('locked', 'open', 'standings_only')),
  updated_at timestamptz not null default now()
);

insert into irene_fitness_voting_settings (id, phase) values (1, 'locked')
  on conflict (id) do nothing;

alter table irene_fitness_voting_settings enable row level security;

-- Track the still-missing piece on the living Systems Status backlog
-- (dashboard-v2/systems-status), not just in chat: the admin dashboard now
-- has vote totals, grade stats, and a phase toggle, but there is no public
-- voting/gallery page yet for anyone to actually cast a vote on, and no
-- "view as anonymous" preview target until that page exists.
insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('fulfilment', 'Irene Fitness public voting/gallery page', 'not_started', 'Admin dashboard now tracks vote totals (funniest/most_inspiring/mad_scientist, 1 vote per device per response per category per day) and a phase toggle (locked/open/standings_only), but the public page voters would actually use does not exist yet - votes will read 0 until it ships. "View as anonymous" preview on the admin dashboard is disabled pending this.', 6);
