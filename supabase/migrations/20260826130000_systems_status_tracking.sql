-- Dashboard v2's Systems Status screen (RAD_Academy_Admin_Dashboard_System_
-- Design_v1.md §3.3 / §5 build order item 4): "the Business Systems Map,
-- turned into something you update by clicking instead of editing markdown."
-- Seeded from RAD_Academy_Business_Systems_Map_v1_1.md's own content,
-- updated with what's been verified built or advanced during this session
-- (e.g. ad_id/ctwa_clid columns already exist on leads; a real 48-hour
-- hold-and-expire mechanic now exists via the finance-v2 quote-accept flow;
-- event registration series tracking shipped after the map doc was written).

create table systems_status (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  purpose text not null,
  priority_tier text not null check (priority_tier in ('now', 'next', 'later')),
  sort_order integer not null default 0
);

create table system_checklist_items (
  id uuid primary key default gen_random_uuid(),
  system_key text not null references systems_status(key) on delete cascade,
  label text not null,
  state text not null default 'not_started' check (state in ('done', 'partial', 'not_started')),
  notes text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('lead_generation', 'Lead Generation', 'Get people who don''t know RAD exists to self-select and say "tell me more," via a free, high-value asset rather than a direct ask.', 'now', 1),
  ('lead_nurture', 'Lead Nurture', 'Provide value to active leads until they self-select "how do I sign up," while gracefully de-prioritising stale ones.', 'now', 2),
  ('onboarding', 'Onboarding', 'Take an interested lead through offer -> forms -> quote -> payment -> confirmation.', 'now', 3),
  ('fulfilment', 'Fulfilment', 'Deliver the paid experience so well it creates raving fans - Pre / During / Post.', 'later', 4),
  ('post_event_nurture', 'Post-Event Nurture', 'Deepen the relationship with paid customers to bring them back for the next event.', 'later', 5),
  ('admin', 'Administration (Spine)', 'Cross-cutting concerns that touch all five systems by nature - money, consent, security, attribution.', 'now', 6);

insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('lead_generation', 'Creative rotation (A/B/C/D1/D2)', 'done', 'Written and scheduled - B/C join week 3, D2 rotates in week 5.', 1),
  ('lead_generation', 'Referral/ad_id capture on lead record', 'partial', 'leads.ad_id/ad_headline/ctwa_clid columns already exist - capture just isn''t complete: ~21% of leads (53/256) have a null source.', 2),
  ('lead_generation', 'Personality-quiz lead magnet', 'not_started', 'Concept only - strong candidate as a 6th creative angle or guide-refresh element.', 3),
  ('lead_generation', 'Lead-quality signal (age/fit of respondent)', 'partial', 'Captured as a free-text admin comment, not a structured field or trend line yet.', 4),
  ('lead_generation', 'Event registration series tracking (/admin/registrations)', 'done', 'Compares recurring event instances month-to-month via event_registrations, decoupled from leads.interested_program_id''s single-slot limitation.', 5),

  ('lead_nurture', 'Content pack design (Meta/Irene/Warm list)', 'done', 'Fully specified.', 1),
  ('lead_nurture', 'Scheduler + morning approval digest', 'not_started', 'Confirmed not built - only a nightly lifecycle-bookkeeping cron exists (api/lead-funnel/cron), no message sending or approval queue.', 2),
  ('lead_nurture', 'Message-cost model (72h free window discipline)', 'done', 'Understood and priced.', 3),
  ('lead_nurture', 'Active vs. stale lead distinction', 'partial', 'stage_health (active/stalled) works and is used on the Lead Journey board. engagement_recency was meant to be this but reads "active" for 100% of leads - looks broken.', 4),

  ('onboarding', 'Assisted Checkout Hybrid handoff', 'done', 'Built and working - unified handler replacing five per-button flows.', 1),
  ('onboarding', 'Structured single-ask (name, email, children+ages)', 'partial', 'Built on the events page, but only captures a child COUNT, not ages.', 2),
  ('onboarding', '48-hour hold + reminder on first payment', 'done', 'Built via the new finance-v2 quote-accept flow (invoices.hold_expires_at, set on invoice #1 only).', 3),
  ('onboarding', 'PayFast payment link', 'done', 'New invoice-v2 pages carry a real PayFast form; the webhook now verifies ITN signatures and has an idempotency guard.', 4),
  ('onboarding', '"Quote valid / quote expired" bucket', 'done', 'Maps onto quotes.status directly - no new schema needed.', 5),

  ('fulfilment', 'Consent form + expectation-setting (Pre)', 'partial', 'Exists for Irene; a general version is partially built.', 1),
  ('fulfilment', 'Sense-of-ownership mechanic (credential card)', 'not_started', 'Near-zero cost - ship close to the event dates.', 2),
  ('fulfilment', '3D-printed figurine loyalty mechanic', 'not_started', 'Real build, queued - right idea, not yet its turn.', 3),
  ('fulfilment', 'Personalised digital workbook', 'not_started', 'Needs a content-authoring pass per age band.', 4),
  ('fulfilment', 'Review-before-leaving form', 'done', 'Done and used at the last Pretoria workshop.', 5),

  ('post_event_nurture', 'Post-event content pack / stage tag', 'not_started', 'Structurally trivial once its turn comes - fits the same 4-lane pattern already built.', 1),

  ('admin', 'Single source of truth on money', 'partial', 'New leads-linked quotes/invoices/invoice_payments pipeline now exists (finance-v2) - the old profiles/billing_records system is frozen but not yet fully migrated off.', 1),
  ('admin', 'POPIA consent state (by lane)', 'partial', 'Now visible on Money & Admin''s consent summary - but two different consent-write paths on leads (consent_marketing vs. marketing_consent_at) still aren''t reconciled.', 2),
  ('admin', 'RLS / anon-key discipline on new tables', 'done', 'Checked on every new table this session (leads/quotes/invoices/etc. confirmed locked to service-role, routed through admin/api/* accordingly).', 3),
  ('admin', 'Referral/source attribution (ad_id, ctwa_clid)', 'partial', 'Columns exist on leads; population isn''t complete across all lanes.', 4);

alter table systems_status enable row level security;
alter table system_checklist_items enable row level security;
