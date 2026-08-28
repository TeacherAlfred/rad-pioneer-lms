-- Brought-forward balances for clients migrating off the legacy finance
-- system (billing_records/profiles) onto v2 (leads/quotes/invoices). This
-- is deliberately a single manually-entered figure per lead, not a
-- reconstruction of legacy history: no FK into billing_records, no linking
-- to a Pricing Library package (that would make the balance's "cost" flow
-- into the Cash Waterfall's delivery-cost rollup as a brand-new obligation,
-- even though the underlying service was already rendered and settled
-- under the old system). legacy_reference/description are free text purely
-- so the admin can find the source record later if a client asks.
create table lead_balance_forward (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads(id) on delete cascade,
  amount numeric not null check (amount > 0),
  as_of_date date not null,
  legacy_reference text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lead_balance_forward enable row level security;

-- Payments logged against a brought-forward balance going forward - kept
-- separate from invoice_payments since there's no invoice here, but bucketed
-- the same way (by received_at) so the Cash Waterfall's running balance can
-- fold real cash collected against legacy debt into "true cash position",
-- same as any other payment.
create table lead_balance_forward_payments (
  id uuid primary key default gen_random_uuid(),
  balance_forward_id uuid not null references lead_balance_forward(id) on delete cascade,
  amount numeric not null check (amount > 0),
  received_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index lead_balance_forward_payments_balance_forward_id_idx on lead_balance_forward_payments(balance_forward_id);

alter table lead_balance_forward_payments enable row level security;
