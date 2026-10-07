-- Per-series onboarding content shown before the tutorial list itself
-- (RAD_Tutorial_Hub_Page_Spec.md follow-up: "before the actual Tutorials,
-- add Accessing the resources / The Platform UI / Finding Tutorials").
-- Scoped per series (not global) so a future non-MakeCode series - Scratch,
-- Minecraft Education - can carry its own accurate onboarding content
-- instead of inheriting MakeCode-specific instructions; the admin series-
-- create route seeds every new series with the three standard items as a
-- starting point to edit, not a hardcoded requirement.
--
-- hotspots is the "Guide" popup data for image-based items (The Platform
-- UI / Finding Tutorials): an array of {id, x, y, label, text} where x/y
-- are 0-100 percentages of the image's rendered box, placed by clicking
-- the image in the admin editor. Defaults to an empty array so an item
-- with an image but no hotspots yet still renders cleanly.
create table tutorial_series_intro_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  series_id uuid not null references tutorial_series(id) on delete cascade,
  title text not null,
  instruction text not null,
  image_url text,
  hotspots jsonb not null default '[]'::jsonb,

  order_index integer not null default 0,

  unique (series_id, order_index)
);

alter table tutorial_series_intro_items enable row level security;

-- Same public-read posture as tutorial_series/tutorials/tutorial_steps:
-- readable once the parent series is published.
create policy "tutorial_series_intro_items_public_read" on tutorial_series_intro_items
  for select
  using (
    exists (
      select 1 from tutorial_series s
      where s.id = series_id and s.is_hidden = false
    )
  );

create index tutorial_series_intro_items_series_order_idx
  on tutorial_series_intro_items (series_id, order_index);
