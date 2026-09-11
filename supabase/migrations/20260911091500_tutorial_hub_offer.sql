-- Admin-configurable "next step" offer shown on the Tutorial Hub (spec S6):
-- a quiet card on the Hub view and a more prominent placement at series
-- completion, both reading the single active row here so there is one
-- content source for both placements. Same publish-window-free pattern as
-- featured_programs but gated on a single is_active flag instead of a date
-- range, since this offer doesn't rotate on a schedule.
create table tutorial_offer_config (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  headline text not null,
  body text,
  cta_label text not null default 'Learn more',
  destination_url text not null,
  accent text not null default 'bg-rad-blue'
    check (accent in ('bg-rad-teal', 'bg-rad-blue', 'bg-rad-purple', 'bg-rad-green', 'bg-rad-yellow')),

  is_active boolean not null default false
);

alter table tutorial_offer_config enable row level security;

create policy "tutorial_offer_config_public_read" on tutorial_offer_config
  for select
  using (is_active = true);

create unique index tutorial_offer_config_single_active_idx
  on tutorial_offer_config (is_active) where is_active;

-- Click log for the offer (spec S8 attribution) - carries channel attribution
-- and, once the progress migration below runs, the resolved visitor if the
-- clicker had already linked a phone number. Not public content, so this
-- gets zero anon policies like consent_token_access_log - reachable only via
-- a service-role API route.
create table tutorial_offer_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  offer_id uuid references tutorial_offer_config(id) on delete set null,
  placement text not null check (placement in ('hub_card', 'series_completion')),
  series_id uuid references tutorial_series(id) on delete set null,
  tutorial_id uuid references tutorials(id) on delete set null,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ip_address text
);

alter table tutorial_offer_clicks enable row level security;

create index tutorial_offer_clicks_offer_idx on tutorial_offer_clicks (offer_id);
create index tutorial_offer_clicks_created_at_idx on tutorial_offer_clicks (created_at);
