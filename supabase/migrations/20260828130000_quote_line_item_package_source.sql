-- The admin Quote Composer now lets a single quote mix line items pulled
-- from several different priced packages (attach a curriculum programme up
-- top, then pick-and-mix package/programme lines below) - quotes.
-- event_package_id can only hold one value, so it's not enough once a quote
-- has more than one package-sourced line. Each line records its own source
-- package here instead of that being guessable from the description text.
alter table quote_line_items
  add column event_package_id uuid references event_packages(id);
