-- Robotics Day live workshop platform (RAD_Workshop_Platform_MVP_Spec_v1.md):
-- one participants table, three screens (kid sign-in, big-screen public
-- display, admin console) reading/writing the same record. Low-stakes,
-- single-day event data - RLS is permissive (anon can read/write) rather
-- than locked down per-column, matching the pragmatic pattern already used
-- for irene_fitness_votes etc. in this project. The admin console itself is
-- protected at the app layer by the existing /admin middleware auth check,
-- not by RLS.
create table robotics_day_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null check (team in ('A', 'B')),
  avatar text,
  tier smallint check (tier in (1, 2, 3)),
  points int not null default 0,
  created_at timestamptz not null default now()
);

create index robotics_day_participants_team_idx on robotics_day_participants(team);

alter table robotics_day_participants enable row level security;

create policy "robotics_day_participants_public_select"
  on robotics_day_participants for select
  using (true);

create policy "robotics_day_participants_public_update"
  on robotics_day_participants for update
  using (true) with check (true);

-- Live-editable team display names ("aka" names), separate from the fixed
-- A/B key used everywhere else in the schema so re-labelling a team on the
-- big screen mid-session never requires touching participant rows.
create table robotics_day_teams (
  team text primary key check (team in ('A', 'B')),
  display_name text,
  updated_at timestamptz not null default now()
);

alter table robotics_day_teams enable row level security;

create policy "robotics_day_teams_public_select"
  on robotics_day_teams for select
  using (true);

create policy "robotics_day_teams_public_update"
  on robotics_day_teams for update
  using (true) with check (true);

insert into robotics_day_teams (team, display_name) values ('A', null), ('B', null);

insert into robotics_day_participants (name, team) values
  ('Anesu', 'A'),
  ('Thando', 'A'),
  ('Bonga', 'A'),
  ('Ngcungcu', 'A'),
  ('Rotondwa', 'A'),
  ('Carryn', 'B'),
  ('Naledi', 'B'),
  ('Ubunzulu', 'B'),
  ('Olu', 'B'),
  ('Tondani', 'B');
