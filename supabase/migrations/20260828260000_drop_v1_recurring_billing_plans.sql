-- All new financial billing functionality is standardised on the v2
-- pipeline (leads/quotes/invoices), not the legacy v1 billing_records/
-- corporate_clients tables - recurring_billing_plans (added in
-- 20260828250000) was built against v1 before that was settled. Dropping it
-- here; the v2 replacement is created fresh, pointed at leads/quotes/
-- invoices instead.
drop table if exists recurring_billing_plans;
