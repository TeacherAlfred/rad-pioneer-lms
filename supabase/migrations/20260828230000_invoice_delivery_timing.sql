-- Cash Waterfall spec assumed delivery happens in the same month an
-- invoice is due - real cases break that: a workshop instalment due in
-- August can be for a workshop actually running in October, and some
-- services (e.g. a multi-month lesson bucket) don't start at all until
-- the invoice is actually paid, with the start month itself tentative.
--
-- delivery_month overrides which month's Cash Waterfall an invoice's
-- delivery cost is attributed to - null means "same month as due_at"
-- (unchanged default behaviour). delivery_gated_on_payment excludes the
-- invoice from every month's waterfall until status = 'paid', since
-- there's no real spend obligation to plan for until the client has
-- actually committed by paying. due_at itself is untouched - it still
-- drives the Due tracker (when the client needs to pay), which is a
-- separate question from when the cost is actually incurred.
alter table invoices
  add column delivery_month text,
  add column delivery_gated_on_payment boolean not null default false;
