-- Tutorial Hub (radacademy.co.za/tutorials) content model: Series -> Tutorial ->
-- Step. Public, unauthenticated library distributed via webinar/flyer/campaign
-- links (see RAD_Tutorial_Hub_Page_Spec.md). Deliberately separate from the
-- internal courses/modules/missions engine, which is gated and XP-based for
-- the paid curriculum - this is free, public, browsable content.
--
-- Same posture as featured_programs: public marketing/content, so each table
-- gets an anon-readable SELECT policy scoped to a publish flag rather than
-- being locked down to service-role only. Admin writes still go through a
-- service-role /admin/api/tutorials/* route only.
create table tutorial_series (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  slug text not null unique,
  title text not null,
  description text,
  level text not null default 'beginner'
    check (level in ('beginner', 'intermediate', 'advanced')),
  category text,
  estimated_minutes integer,
  cover_image_url text,

  sort_order integer not null default 0,
  is_hidden boolean not null default true
);

alter table tutorial_series enable row level security;

create policy "tutorial_series_public_read" on tutorial_series
  for select
  using (is_hidden = false);

create index tutorial_series_sort_order_idx on tutorial_series (sort_order);
create index tutorial_series_category_idx on tutorial_series (category);

create table tutorials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  series_id uuid not null references tutorial_series(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  estimated_minutes integer,

  order_index integer not null default 0,
  is_hidden boolean not null default true,

  unique (series_id, slug)
);

alter table tutorials enable row level security;

create policy "tutorials_public_read" on tutorials
  for select
  using (
    is_hidden = false
    and exists (
      select 1 from tutorial_series s
      where s.id = series_id and s.is_hidden = false
    )
  );

create index tutorials_series_order_idx on tutorials (series_id, order_index);

create table tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  tutorial_id uuid not null references tutorials(id) on delete cascade,
  instruction text not null,
  image_url text,
  why_this_works text,

  order_index integer not null default 0,

  unique (tutorial_id, order_index)
);

alter table tutorial_steps enable row level security;

create policy "tutorial_steps_public_read" on tutorial_steps
  for select
  using (
    exists (
      select 1 from tutorials t
      join tutorial_series s on s.id = t.series_id
      where t.id = tutorial_id and t.is_hidden = false and s.is_hidden = false
    )
  );

create index tutorial_steps_tutorial_order_idx on tutorial_steps (tutorial_id, order_index);
