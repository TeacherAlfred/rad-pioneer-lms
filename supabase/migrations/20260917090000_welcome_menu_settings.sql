-- Makes the generic (non-ad-set) welcome menu admin-editable from
-- /admin/lead-funnel/welcome-menu instead of hardcoded in
-- whatsapp-webhook/route.ts's STAGE 1 catch-all. Null means "use the
-- built-in default copy" - the webhook falls back to its own hardcoded text
-- when these are unset, so this ships with zero behavior change until an
-- admin actually edits something. Scoped to the generic welcome menu only -
-- the robotics-watch ad set's own purpose-built greeting stays hardcoded,
-- it's tied to a specific Meta ad campaign, not a general-purpose message.
alter table dashboard_settings
  add column if not exists welcome_message_new text,
  add column if not exists welcome_message_returning text,
  add column if not exists welcome_buttons jsonb not null default '[]'::jsonb;
