-- Shared RAD Lab FAQs, edited on /admin/labs ("Shared FAQs" panel).
--
-- One row per bucket: key 'global' = "About RAD Labs" questions shown on
-- every lab; any other key = a series key (e.g. 'makecode') whose questions
-- show on every lab in that series. `items` is a JSON array of
-- { q, a } (a = rich text, same tokens as lab content), validated
-- server-side before every write.
--
-- A bucket with no row falls back to the defaults in
-- src/content/labs/faq-shared.ts, so the table can start empty.
-- Same access model as `labs`: RLS on, no anon policies, service role only.

create table lab_shared_faqs (
  key text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table lab_shared_faqs enable row level security;

update system_checklist_items
set state = 'done',
    notes = 'Shared FAQs panel on /admin/labs: "All labs" tab + one tab per series. Stored in lab_shared_faqs; buckets without a row fall back to src/content/labs/faq-shared.ts.',
    updated_at = now()
where system_key = 'rad_labs' and label = 'Edit series + "all labs" FAQs from the admin';
