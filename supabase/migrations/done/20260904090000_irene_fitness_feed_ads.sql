-- Native promotional cards in the Irene Fitness feed - "micro ads" that
-- rotate into the scroll alongside real entries (community/page.tsx),
-- expiring via live_from/live_until same as the main site's
-- featured_programs (20260821090000), just gated in application code (see
-- api/irene-fitness/feed-ads) rather than an RLS policy, matching every
-- other irene_fitness_* table's convention: service-role only, zero anon
-- policies, all access through API routes.
create table irene_fitness_feed_ads (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  cta_label text not null,
  contact_prefill text not null,
  live_from timestamptz not null default now(),
  live_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint irene_fitness_feed_ads_live_range check (live_until >= live_from)
);

alter table irene_fitness_feed_ads enable row level security;

-- First ad: the free robotics/coding webinar, using the existing
-- step-counter creative. live_until is end-of-day 11 September 2026 SAST -
-- a "join us" card has no business still showing the week after.
insert into irene_fitness_feed_ads (image_url, cta_label, contact_prefill, live_until) values (
  'https://pub-5baa3fb9dc2549008c18dac88b524ed9.r2.dev/marketing_material/flyers/What_if_step-counter_1080x1920.jpg',
  'Register for the Free Webinar',
  E'I\'d like to register for the free webinar.',
  '2026-09-11 23:59:00+02'
);
