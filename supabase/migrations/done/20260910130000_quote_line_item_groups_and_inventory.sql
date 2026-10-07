-- Adds section grouping and inventory-catalog traceability to quote line
-- items, for the grouped ICP quote format (Workshop / Materials /
-- Additional Coaching sections, plus a priced-then-comped Bonus line).
-- quote_line_items itself predates supabase/migrations/ (applied live -
-- see 20260827110000_pricing_engine_core.sql:105-110) but has already
-- been extended through tracked migrations since (event_package_id in
-- that same file, event_package_quantity in
-- 20260828200000_quote_line_item_event_package_quantity.sql) - same
-- precedent applies here.
alter table quote_line_items
  add column group_label text,
  add column inventory_item_id uuid references inventory_items(id);
