-- Lets an admin annotate a captured payment with what it went toward - e.g.
-- "this R5000 covered rent" - without that being a real reservation of
-- funds. The pool itself is unchanged: everything received still flows into
-- one balance (Cash Waterfall's running balance already models that), and a
-- standing expense still only actually gets paid from that pool on its own
-- due date. This is purely a bookkeeping note for "when this money came in,
-- I managed to pay for such and such," useful for visualizing cashflow as
-- income stops being immediately absorbed by pending obligations.
--
-- capture_batch_id groups every invoice_payments row written by one capture
-- POST call (a single "receipt" of cash can be split across many invoices)
-- so an allocation can point at the receipt as a whole rather than one
-- arbitrary invoice_payments row within it.
alter table invoice_payments add column capture_batch_id uuid;

-- expense_id is nullable with on delete set null (rather than cascade) and
-- expense_name is a snapshot, not a live join - deleting or renaming the
-- standing expense later shouldn't erase or silently rewrite the historical
-- note of what this receipt was earmarked for.
create table income_expense_allocations (
  id uuid primary key default gen_random_uuid(),
  capture_batch_id uuid not null,
  expense_id uuid references monthly_expenses(id) on delete set null,
  expense_name text not null,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index income_expense_allocations_capture_batch_id_idx on income_expense_allocations (capture_batch_id);
create index invoice_payments_capture_batch_id_idx on invoice_payments (capture_batch_id);
