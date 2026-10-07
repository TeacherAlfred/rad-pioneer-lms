-- Quote & Pricing Engine (RAD_Academy_Quote_Pricing_Engine_Spec_v1.md) - the
-- items-inventory / package / margin-aware pricing data model, plus the
-- columns needed to attach a priced package to a featured_programs card and
-- carry that choice through to a quotes row. See spec §2, §4-§6.
--
-- Design note: composing a package (what items make it up) is a separate
-- concern from pricing it for a specific program (cost rollup depends on
-- that program's expected_attendee_count, and margin is a founder call made
-- per-program) - inventory_items/packages/package_items are the reusable
-- library, event_packages is the per-program attach-and-price row. See the
-- admin UI split: /admin/pricing (library) vs featured-programs edit (attach
-- + price + email template, gated before a program can go live).

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('venue', 'catering', 'materials', 'staffing', 'licensing', 'mentorship', 'other')),
  cost_type text not null check (cost_type in ('flat', 'per_unit', 'per_session')),
  unit_cost numeric(10,2) not null default 0,
  unit_label text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null check (event_type in ('workshop', 'term_lessons', 'priority_coaching', 'webinar')),
  description text,
  child_facing_blurb text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity_type text not null check (quantity_type in ('per_child', 'flat')),
  quantity_override integer,
  created_at timestamptz not null default now()
);

create index package_items_package_id_idx on package_items(package_id);
create index package_items_inventory_item_id_idx on package_items(inventory_item_id);

-- featured_program_id null = globally available (e.g. Priority Coaching,
-- spec §9.4 - "genuinely location-flexible... doesn't need a separate
-- package per event").
create table event_packages (
  id uuid primary key default gen_random_uuid(),
  featured_program_id uuid references featured_programs(id) on delete cascade,
  package_id uuid not null references packages(id) on delete restrict,
  tier_role text not null check (tier_role in ('anchor', 'recommended', 'lighter')),
  display_order integer not null default 0,
  expected_attendee_count_override integer,
  computed_cost numeric(10,2),
  target_margin_pct numeric(5,2),
  recommended_fee numeric(10,2),
  final_fee numeric(10,2),
  margin_override_reason text,
  override_reason_category text check (override_reason_category in (
    'penetration_pricing', 'loyalty_referral_discount', 'competitive_response',
    'loss_leader_lead_gen', 'founder_discretion_other'
  )),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Spec §6 hard guardrail: never sell below cost silently - if final_fee
  -- implies a loss, an override reason is mandatory, enforced at the DB
  -- layer (not just the admin UI) so it can't be bypassed by a direct write.
  constraint event_packages_below_cost_needs_reason check (
    final_fee is null or computed_cost is null or final_fee >= computed_cost
    or (margin_override_reason is not null and override_reason_category is not null)
  )
);

create index event_packages_featured_program_id_idx on event_packages(featured_program_id);
create index event_packages_package_id_idx on event_packages(package_id);

alter table inventory_items enable row level security;
alter table packages enable row level security;
alter table package_items enable row level security;
alter table event_packages enable row level security;

-- Attaches a featured_programs marketing card to the real curriculum/
-- delivery model, which it has never had a link to (see spec's open item
-- #1 - no `events` table exists; `featured_programs` was purely marketing
-- content until now). expected_attendee_count is the shared apportionment
-- basis for every event_package under this card (spec §5 - flat costs like
-- venue hire are shared across packages at the same event, not duplicated
-- per package). quote_email_template_id + quote_email_template_needs_review
-- back the compulsory "pick a quote email template per program" step.
alter table featured_programs
  add column programs_id uuid references programs(id),
  add column default_session_id uuid references sessions(id),
  add column expected_attendee_count integer,
  add column quote_email_template_id uuid references email_templates(id),
  add column quote_email_template_needs_review boolean not null default false;

-- quotes/quote_line_items/invoices already exist live (applied directly to
-- Supabase, not tracked in supabase/migrations/ - confirmed via
-- src/app/admin/api/finance-v2/quotes/route.ts). event_package_id traces a
-- quote back to which tier was picked (reporting); source distinguishes an
-- admin-composed quote from one a lead self-generated via the package
-- picker (spec's fully-automatic self-serve flow).
alter table quotes
  add column event_package_id uuid references event_packages(id),
  add column source text not null default 'admin' check (source in ('admin', 'self_serve'));
