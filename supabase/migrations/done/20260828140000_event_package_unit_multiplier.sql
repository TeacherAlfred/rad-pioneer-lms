-- Lets one package definition (e.g. "Workshop — Per Day") represent any
-- number of days/units at attach time, instead of needing a separate
-- package per day-count (the "Day 1"/"Day 2"/"Both Days" approach this
-- replaces for Polokwane). unit_multiplier scales the whole rollup for
-- this one attachment - see computeCostRollup in src/lib/pricingEngine.ts.
-- A package that genuinely mixes two different unit counts within itself
-- (e.g. "2 days of workshop + 1 month of term lessons") still needs its own
-- per-item quantity_override, since one outer multiplier can't apply
-- differently to different items in the same package.
alter table event_packages
  add column unit_multiplier integer not null default 1;
