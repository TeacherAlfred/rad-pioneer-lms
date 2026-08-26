-- Finance Pipeline: Cash Waterfall spec §2. `payment_schedule` (§2.1) is
-- deliberately NOT built as a new table here - the existing `invoices`
-- table already is one row per expected payment (a full-term quote makes
-- one row, a monthly split makes N), which is exactly what §2.1 wants.
-- Building a parallel table would duplicate it, against the spec's own §1
-- principle. Only the two genuinely new pieces are added below.

-- §2.2 - standing expenses (rent, subscriptions, recurring admin overhead).
-- Nothing else in the system knows about these; delivery-linked costs are
-- rolled up from pricing-engine data instead (see quote_line_item_costs
-- below), never re-entered here.
create table monthly_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10,2) not null,
  due_date date not null,
  payment_timing text not null default 'post_paid' check (payment_timing in ('pre_paid', 'post_paid')),
  recurring boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table monthly_expenses enable row level security;

-- §2.3's delivery-linked rollup needs real per-unit costs attached to each
-- payment (invoice/quote_line_item), not just a category label. A line
-- sourced from a priced Pricing Package already has this via
-- quote_line_items.event_package_id -> event_packages.computed_cost - this
-- table is for everything else (freeform/programme-only lines, the vast
-- majority of quotes so far), letting an admin say "this line item's real
-- cost is these inventory items, at these quantities" after the fact.
create table quote_line_item_costs (
  id uuid primary key default gen_random_uuid(),
  quote_line_item_id uuid not null references quote_line_items(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(10,2) not null default 1,
  created_at timestamptz not null default now()
);

alter table quote_line_item_costs enable row level security;
create index quote_line_item_costs_line_item_idx on quote_line_item_costs(quote_line_item_id);
