-- Corporate clients like Chimo Consulting Services get invoiced the same
-- amount every month (a consulting retainer), but until now each month's
-- invoice was created from scratch by hand in the old billing composer -
-- nothing tracked "this client owes another R2,500 next month" or linked
-- the recurring amount back to the quote that was actually approved for it.
--
-- recurring_billing_plans is the record of that standing agreement: one row
-- per corporate client per recurring engagement, holding the line items/
-- amount to re-bill, the cadence, and when the next invoice falls due.
-- source_quote_id points at the billing_records quote (doc_type='quote',
-- status='accepted') that the client actually signed off on - the plan
-- exists because that quote was approved, not the other way round.
-- Actual invoice generation still writes a normal billing_records row
-- (doc_type='invoice') via the API layer; this table only tracks the
-- schedule and links each generated invoice back via last_generated_invoice_id.
--
-- RLS enabled with zero policies (matches quotes/leads, not the legacy
-- wide-open billing_records/corporate_clients) - all reads/writes go
-- through /admin/api/finance/recurring-plans/* (service-role only).
create table recurring_billing_plans (
  id uuid primary key default gen_random_uuid(),
  corporate_client_id uuid not null references corporate_clients(id) on delete cascade,
  source_quote_id uuid references billing_records(id) on delete set null,
  line_items jsonb not null,
  total_amount numeric not null check (total_amount > 0),
  frequency text not null default 'monthly' check (frequency in ('monthly')),
  next_due_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  last_generated_invoice_id uuid references billing_records(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_billing_plans_client_idx on recurring_billing_plans(corporate_client_id);
create index recurring_billing_plans_due_idx on recurring_billing_plans(status, next_due_date);

alter table recurring_billing_plans enable row level security;
