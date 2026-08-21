-- Splits the single "stay in the loop" checkbox into two independent
-- consents: community-initiative updates (this event only) vs. RAD Academy
-- programme marketing (the one that hands off to leads). They were never
-- the same thing and shouldn't share one boolean.
alter table irene_fitness_families
  add column consent_updates boolean not null default false,
  add column consent_updates_timestamp timestamptz;
