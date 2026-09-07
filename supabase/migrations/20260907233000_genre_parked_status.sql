-- Adds a 'parked' categorization_status: books the admin has looked at in
-- the Needs Review queue but doesn't have enough information to categorize
-- yet. Parked books are excluded from both the Needs Review queue and the
-- automated batch's pending/failed selection, so they stop cluttering
-- either list until deliberately moved back to 'needs_review'.

alter table rad_books drop constraint rad_books_categorization_status_check;
alter table rad_books add constraint rad_books_categorization_status_check
  check (categorization_status in ('pending', 'success', 'needs_review', 'failed', 'parked'));
