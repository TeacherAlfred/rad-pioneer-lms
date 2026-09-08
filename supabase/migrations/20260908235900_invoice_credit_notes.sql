-- Superseding a quote (quotes/[id]/supersede) only ever touched the quotes
-- table - any invoice already raised against the original quote (e.g.
-- INV-27, superseded by INV-28) was left sitting as a live, still-due
-- invoice with no way to write it off. 'credited' is a new invoice.status
-- value (the column is plain text, no enum constraint, so this needs no
-- migration of existing rows) meaning "voided, nothing left to collect" -
-- distinct from 'paid' so cash-received reporting (Income, Cash Waterfall's
-- paid bucket) never mistakes a credit for real money in the bank.
alter table invoices
  add column credited_at timestamptz,
  add column credit_reason text;
