-- Cash Waterfall spec §4's due-date ordering drives the actual shortfall
-- calculation (which items get marked covered vs. shortfall), not just
-- display order - so a manual override has to be a real, persisted
-- re-ordering of the same list both scenarios run against, not a
-- cosmetic reshuffle. One full snapshot per month, not per-item ranks,
-- to avoid rank-collision ambiguity when items are inserted between
-- others - reordering always replaces the whole saved sequence for that
-- month. item_key matches the waterfall item's own id (e.g. "inv-<uuid>"
-- or "exp-<uuid>"); anything not present in a month's override falls back
-- to its natural due-date position.
create table cash_waterfall_priority_overrides (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  item_key text not null,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, item_key)
);

alter table cash_waterfall_priority_overrides enable row level security;
create index cash_waterfall_priority_overrides_month_idx on cash_waterfall_priority_overrides(month);
