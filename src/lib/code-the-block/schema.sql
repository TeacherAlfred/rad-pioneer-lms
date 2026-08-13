-- Code the Block workbook schema.
-- Reuses rad-pioneer's existing Supabase project — tables are prefixed
-- `ctb_` so they're clearly scoped to this feature and don't collide with
-- anything else in the project. Run this in that project's SQL editor.

create table ctb_workshops (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,        -- shared code kids type in, e.g. "CTB-AUG"
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ctb_students (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references ctb_workshops(id) on delete cascade,
  first_name text not null,
  last_initial text not null,
  created_at timestamptz not null default now(),
  unique (workshop_id, first_name, last_initial)
);

create table ctb_progress (
  student_id uuid not null references ctb_students(id) on delete cascade,
  step_id text not null,            -- matches a step id in src/lib/code-the-block/content
  completed_at timestamptz not null default now(),
  primary key (student_id, step_id)
);

-- RLS enabled with no public policies: all reads/writes go through Next.js
-- Server Actions using the service_role key, never exposed to the browser.
alter table ctb_workshops enable row level security;
alter table ctb_students enable row level security;
alter table ctb_progress enable row level security;

-- Seed the workshop used for the first run. Update the code/title as needed,
-- or insert additional rows for future workshops.
insert into ctb_workshops (code, title)
values ('CTB-AUG', 'Code the Block — Minecraft Education Workshop');
