-- Class is being made optional on the Irene Fitness submission form; only
-- Grade stays required. Relax the NOT NULL constraint from
-- 20260825120000_irene_fitness_consent_submission.sql accordingly.
alter table irene_fitness_children alter column class drop not null;
