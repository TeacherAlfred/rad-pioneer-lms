-- Projects hub rework: replaces the hardcoded PROJECTS array in
-- admin/api/dashboard-v2/projects/route.ts with a real table spanning both
-- "idea, still forming" and "active, tracked project" in one lifecycle -
-- stage flips from 'idea' to 'active' on conversion, nothing gets copied to
-- a second table, so checklist/attachment FKs never need to move.
--
-- Checklist items are a real table (project_checklist_items), not jsonb,
-- matching this codebase's existing convention for admin-editable checklists
-- (system_checklist_items, dashboard_focus_items) rather than the Drizzle-
-- side radEvents.checklist jsonb column (a different subsystem entirely -
-- DATABASE_URL/Drizzle, not Supabase).
--
-- Locking is a governance record, not git enforcement - the app cannot and
-- does not attempt to block real git operations. Locking requires a branch
-- name + written risk/justification note up front (enforced by the check
-- constraint below) and shows a persistent warning banner on the project
-- page while locked.

create table projects (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- stable slug; matches the switch-key pattern already used for teaser stats and bespoke sub-app hrefs (e.g. 'irene-fitness')
  name text not null,
  description text, -- doubles as idea notes pre-conversion and project description post-conversion; same field, not wiped on convert
  stage text not null default 'idea' check (stage in ('idea', 'active')),
  category text not null default 'private' check (category in ('private', 'public')),
  status text not null default 'draft' check (status in ('draft', 'uat', 'live')),
  href text, -- nullable: set once a bespoke sub-app exists (like /admin/dashboard-v2/projects/irene-fitness); the generic project detail page is used until then
  locked boolean not null default false,
  locked_at timestamptz,
  lock_branch_name text,
  lock_risk_notes text,
  converted_at timestamptz, -- set when stage flips idea -> active
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not locked or (lock_branch_name is not null and lock_risk_notes is not null))
);

create index projects_stage_status_category_idx on projects (stage, status, category);

create table project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_checklist_items_project_id_idx on project_checklist_items (project_id, sort_order);

-- Either an uploaded R2 object (library bucket, projects/ key prefix - see
-- upload-project-attachment/route.ts) or an external link - exactly one of
-- the two, never both/neither.
create table project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes bigint,
  r2_key text,
  external_url text,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  check ((r2_key is not null) <> (external_url is not null))
);

create index project_attachments_project_id_idx on project_attachments (project_id);

alter table projects enable row level security;
alter table project_checklist_items enable row level security;
alter table project_attachments enable row level security;

-- Retire the hardcoded PROJECTS array: seed the one existing bespoke project
-- as an active/public/live row with its href intact.
insert into projects (key, name, href, stage, category, status, converted_at)
values ('irene-fitness', 'Irene Primary Fitness Community', '/admin/dashboard-v2/projects/irene-fitness', 'active', 'public', 'live', now());

-- Systems Status tracking entry for this build.
insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('projects_ideas_and_lock', 'Projects: Ideas, Categories, Lock', 'A project-ideas board (notes, checklist, R2 attachments) that converts into a tracked project grouped by private/public and draft/uat/live, with a lock governance record + warning banner for main-branch protection.', 'now', 9)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('projects_ideas_and_lock', 'Schema: projects / project_checklist_items / project_attachments', 'done', 'Idea and active-project stages share one row via projects.stage.', 1),
  ('projects_ideas_and_lock', 'Idea board + convert-to-project action', 'done', null, 2),
  ('projects_ideas_and_lock', 'Project list grouped by category/status', 'done', null, 3),
  ('projects_ideas_and_lock', 'Lock governance record (branch + risk notes) + warning banner', 'done', 'Governance record only - no real git enforcement.', 4),
  ('projects_ideas_and_lock', 'R2 attachment upload/download (library bucket, projects/ prefix)', 'done', null, 5)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
