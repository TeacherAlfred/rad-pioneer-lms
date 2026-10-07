-- Server-side IP exclusion list for the generic analytics_events log
-- (src/app/api/track/route.ts) - lets an admin mark their own/office IPs
-- so admin browsing doesn't inflate real visitor counts. Deliberately not
-- scoped to the Tutorial Hub specifically ("all analytics") even though
-- the Tutorial Hub analytics route (/admin/api/tutorials/analytics) is its
-- first consumer - any future analytics aggregation can filter against the
-- same table rather than each rebuilding its own list. Distinct from the
-- existing per-browser localStorage ignore-list on /admin/analytics (that
-- one is a client-side display filter for one admin's own dashboard view;
-- this one is server-side and affects every aggregation that reads it).
create table analytics_excluded_ips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_address text not null unique,
  note text
);

alter table analytics_excluded_ips enable row level security;
