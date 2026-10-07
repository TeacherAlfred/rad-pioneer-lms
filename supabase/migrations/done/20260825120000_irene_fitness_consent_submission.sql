-- Irene Primary Fitness Challenge — consent-first submission platform.
-- Deliberately fresh tables, unrelated to the old irene_responses/irene_voters/
-- irene_votes schema (that platform is being retired, not extended) — see
-- Irene_Consent_Submission_Page_Spec.md §7 and §10.3. Prefixed irene_fitness_
-- to avoid any collision with the old irene_* tables above.

create table irene_fitness_families (
  id uuid primary key default gen_random_uuid(),
  whatsapp text unique,
  email text unique,
  ip_address inet,
  consent_public_display boolean not null default false,
  consent_public_display_timestamp timestamptz,
  consent_wording_version text,
  consent_source text,
  consent_marketing boolean not null default false,
  consent_marketing_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint irene_fitness_families_has_contact check (whatsapp is not null or email is not null)
);

-- One public response per family (spec §7.1) — enforced at the DB level.
create table irene_fitness_responses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references irene_fitness_families(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backend-only, never queried by any public-facing endpoint (spec §7.1/§9).
create table irene_fitness_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references irene_fitness_families(id) on delete cascade,
  grade text not null,
  class text not null,
  created_at timestamptz not null default now()
);

create index irene_fitness_children_family_id_idx on irene_fitness_children(family_id);

-- Service-role only, same lockdown convention as leads/kids since 2026-08-12 —
-- no anon policies, all access goes through API routes using the service key.
alter table irene_fitness_families enable row level security;
alter table irene_fitness_responses enable row level security;
alter table irene_fitness_children enable row level security;
