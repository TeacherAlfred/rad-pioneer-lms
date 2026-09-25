-- Clicks on the URL button of a WhatsApp template, counted per template.
--
-- Meta sends no webhook when a URL button is tapped, so a template's URL
-- button points at /t/<template_name>?to=/some/page on our own site instead:
-- that route logs one row here, then forwards the visitor to the real page.
-- Per template only (no lead attribution) - a lead-level version needs a
-- per-lead token in the URL, i.e. a template with a variable URL.

create table if not exists template_link_clicks (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  destination text,
  clicked_at timestamptz not null default now(),
  user_agent text,
  -- Link-preview crawlers and scanners fetch URLs too; flagged, not deleted,
  -- and excluded from the counts.
  is_bot boolean not null default false
);

create index if not exists template_link_clicks_template_idx
  on template_link_clicks (template_name, clicked_at desc);

-- Same access model as the other admin-only tables: RLS on, no anon
-- policies, service role only (the public /t/ route writes with the service
-- role; visitors never touch the table directly).
alter table template_link_clicks enable row level security;

-- Systems Status: the per-template half of URL tracking is now built.
update system_checklist_items
set state = 'partial',
    notes = 'Per-template click counts are built: point a template''s URL button at https://www.radacademy.co.za/t/<template_name>?to=/labs/makecode-01 (static URL, no variable) and clicks show on Message Activity. Needs a NEW template - an approved template''s URL cannot be edited. Submitted to Meta 2026-09-25 as rad_lab_launch_concise_v2 (copy of rad_lab_launch_concise, URL button -> /t/rad_lab_launch_concise_v2). Still not built: per-lead clicks (needs a variable URL /r/{{1}} with a per-lead token).',
    updated_at = now()
where system_key = 'rad_labs' and label = 'Track URL opens for the rad_lab_launch template';
