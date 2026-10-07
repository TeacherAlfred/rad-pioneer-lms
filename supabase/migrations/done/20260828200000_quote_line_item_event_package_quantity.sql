-- A quote line item's billed quantity doesn't always equal how many units
-- of the linked Pricing Package it actually represents - e.g. a single
-- bundled/discounted line ("Family Booking") could cover 2x Pretoria
-- Workshop attendances. Nullable: when unset, cost resolution falls back to
-- the line's own quantity (the common case - a Composer-created Pricing
-- Package line already bills 1:1), so this only needs setting when an
-- admin retroactively links a package via the Cost Linking tab and the
-- counts genuinely differ.
alter table quote_line_items
  add column event_package_quantity numeric(10,2);
