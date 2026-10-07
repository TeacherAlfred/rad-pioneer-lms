-- Tracks manual "does this book look right" verification (cover present,
-- title/author correct) separately from genre categorization_status - a
-- book can be fully genre-categorized and still have a wrong title or
-- missing cover, and vice versa. Same three-state shape as
-- categorization_status: 'pending' (default, not yet looked at), 'verified'
-- (looked at, looks right - excluded from the sequential review queue so it
-- never reappears), 'parked' (looked at, needs more info before deciding -
-- also excluded from the queue, but separately re-visitable).

alter table rad_books
  add column verification_status text not null default 'pending'
    constraint rad_books_verification_status_check
    check (verification_status in ('pending', 'verified', 'parked'));
