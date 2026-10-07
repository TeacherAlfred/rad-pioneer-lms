-- Landing page "Current Programs" carousel content, previously hardcoded
-- as INITIAL_PROGRAMS in src/app/page.tsx. Cards are scheduled by a strict
-- live_from/live_until window - the row is only visible (both to the admin
-- API's public read and the landing page fetch) while now() falls inside
-- that window, so hiding a card is just editing its dates, not a status
-- flag. Images are plain R2 URLs pasted by the admin, not Supabase Storage.
--
-- Public marketing content (unlike leads/kids/programs), so unlike that
-- lockdown convention this table gets an anon-readable SELECT policy
-- scoped to the live window - admin writes still go through the
-- service-role /admin/api/featured-programs route only.
create table featured_programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  label text not null default 'Program',
  location text,
  details text,
  duration text,
  form_label text,

  image_url text not null,
  is_video boolean not null default false,
  accent text not null default 'bg-rad-blue'
    check (accent in ('bg-rad-teal', 'bg-rad-blue', 'bg-rad-purple')),

  sort_order integer not null default 0,
  live_from timestamptz not null default now(),
  live_until timestamptz not null,

  check (live_until >= live_from)
);

alter table featured_programs enable row level security;

create policy "featured_programs_public_read" on featured_programs
  for select
  using (live_from <= now() and live_until >= now());

create index featured_programs_live_window_idx on featured_programs (live_from, live_until);
create index featured_programs_sort_order_idx on featured_programs (sort_order);
