-- RAD Labs content store, edited in place at /admin/labs/[slug].
--
-- One row per lab. `content` is what the public /labs/[slug] page serves;
-- `draft_content` is the admin's unpublished working copy (Save draft
-- writes it, Publish copies it into `content` and clears it). Both hold a
-- LabContent JSON object (src/content/labs/types.ts), validated server-side
-- by src/lib/labContentValidate.ts before every write.
--
-- Labs that only exist as TS seed files (src/content/labs/*.ts) have no row
-- until first saved in the admin - the page falls back to the seed.
-- Same access model as leads: RLS on, zero anon policies, service role only.

create table labs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  content jsonb,
  draft_content jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint labs_has_content check (content is not null or draft_content is not null)
);

alter table labs enable row level security;

-- Systems Status: the in-place editor supersedes "later move off TS files",
-- and the batch of UX refinements that shipped with it.
update system_checklist_items
set state = 'done',
    notes = 'Built as an in-place editor at /admin/labs/[slug]: the real page with an Edit button per section, draft/publish, R2 image links, concept-highlight + link toolbar. Series/global FAQs and the series list still live in src/content/labs.',
    updated_at = now()
where system_key = 'rad_labs' and label = 'Admin/DB-backed lab editor';

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('rad_labs', 'Edit series + "all labs" FAQs from the admin', 'not_started', 'Only each lab''s own FAQs are editable in /admin/labs; shared FAQ buckets are in src/content/labs/faq-shared.ts.', 9)
) as v(system_key, label, state, notes, sort_order)
where exists (select 1 from systems_status where key = 'rad_labs')
  and not exists (
    select 1 from system_checklist_items existing
    where existing.system_key = v.system_key and existing.label = v.label
  );
