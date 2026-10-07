-- Kids, guardian links, and course/event registrations.
-- Deliberately new tables, independent of the older profiles/courses/
-- enrollments pipeline (see /admin/parents) - nothing here reads from or
-- writes to that system. Named `programs`/`program_enrollments` rather
-- than `courses`/`enrollments` because those names are already taken by
-- that older schema. Mirrors the leads/households conventions: uuid pk
-- with gen_random_uuid(), created_at timestamptz default now(), RLS
-- enabled with no policies (service-role only, same lockdown as leads
-- since 2026-08-12).

create table kids (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  age integer,
  grade text,
  phone text,
  email text,
  notes text,
  source text
);

alter table kids enable row level security;

-- Many-to-many: a kid can have 1+ guardians (both parents), and a lead
-- (parent) can have multiple kids. Independent of households - a kid's
-- guardians don't need to already be linked as a household.
create table kid_guardians (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kid_id uuid not null references kids(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  relationship text,
  unique (kid_id, lead_id)
);

alter table kid_guardians enable row level security;
create index kid_guardians_kid_id_idx on kid_guardians(kid_id);
create index kid_guardians_lead_id_idx on kid_guardians(lead_id);

-- Courses/events/bootcamps kids can be registered for. `type` and
-- `status` are free text validated in the app layer, same pattern as
-- leads.status (see FUNNEL_STAGES) rather than a db-level enum.
create table programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  type text not null default 'course',
  description text,
  start_date date,
  end_date date,
  location text,
  status text not null default 'active'
);

alter table programs enable row level security;

create table program_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kid_id uuid not null references kids(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  status text not null default 'registered',
  notes text
);

alter table program_enrollments enable row level security;
create index program_enrollments_kid_id_idx on program_enrollments(kid_id);
create index program_enrollments_program_id_idx on program_enrollments(program_id);

-- One-off backfill: seed kids from the informal children_names[] typed
-- into leads so nothing already captured is lost. leads.children_names
-- itself is left untouched (still readable/editable on the lead-funnel
-- page) - this only copies forward, it doesn't migrate-and-drop.
--
-- Dedupes per family (household_id, or the lead itself when standalone),
-- not globally by name - two unrelated families each with a "Liam" must
-- stay two separate kids, not collapse into one.
create temporary table _kid_migration_staging (
  kid_id uuid not null default gen_random_uuid(),
  family_key uuid not null,
  child_name text not null
);

insert into _kid_migration_staging (family_key, child_name)
select distinct coalesce(l.household_id, l.id), trim(child_name)
from leads l, unnest(l.children_names) as child_name
where l.children_names is not null and trim(child_name) <> '';

insert into kids (id, name, source)
select kid_id, child_name, 'children_names_migration'
from _kid_migration_staging;

insert into kid_guardians (kid_id, lead_id, relationship)
select s.kid_id, l.id, null
from leads l
cross join lateral unnest(l.children_names) as raw_name
join _kid_migration_staging s
  on s.family_key = coalesce(l.household_id, l.id)
  and s.child_name = trim(raw_name)
where l.children_names is not null and trim(raw_name) <> ''
on conflict (kid_id, lead_id) do nothing;

drop table _kid_migration_staging;
