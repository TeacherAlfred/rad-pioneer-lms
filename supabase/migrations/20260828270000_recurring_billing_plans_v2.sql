-- v2 equivalent of the dropped v1 recurring_billing_plans (20260828250000/
-- 20260828260000) - all new financial billing functionality goes through
-- the v2 pipeline, so this points at leads/quotes/invoices instead of the
-- legacy corporate_clients/billing_records.
--
-- One row per standing recurring engagement (e.g. Chimo Consulting
-- Services' monthly retainer). source_quote_id is the accepted v2 quote
-- the client signed off on - line_items/total_amount here are a cached
-- copy of that quote's terms, used to create each cycle's real `invoices`
-- row (invoices carry only a single `amount`, no line items of their own -
-- see invoices.quote_id). Keep this cache in sync whenever the source
-- quote's line items are edited, or the amount actually billed will
-- silently diverge from what the quote says.
create table recurring_billing_plans (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  source_quote_id uuid references quotes(id) on delete set null,
  line_items jsonb not null,
  total_amount numeric not null check (total_amount > 0),
  frequency text not null default 'monthly' check (frequency in ('monthly')),
  next_due_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  last_generated_invoice_id uuid references invoices(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_billing_plans_v2_lead_idx on recurring_billing_plans(lead_id);
create index recurring_billing_plans_v2_due_idx on recurring_billing_plans(status, next_due_date);

alter table recurring_billing_plans enable row level security;
