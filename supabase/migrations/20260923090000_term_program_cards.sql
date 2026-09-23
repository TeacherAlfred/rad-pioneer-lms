-- Term Program landing page (/term-program): an evergreen, admin-managed
-- "one stop shop" of a term's workshops/online lessons, refreshed a few
-- weeks before each term starts rather than getting a new URL each time.
-- Reuses featured_programs rather than a new table - title/details/
-- location/duration/image_url/date_options/label/series all carry over
-- as-is (date_options is already the "choose Sat or Sun" mechanism this
-- page needs). What's missing is per-card marketing copy this page shows
-- that other featured_programs surfaces don't (age band / fee / spots
-- left / a status badge for TBC cards), a card_kind driving button copy
-- and card treatment, and a third surface flag alongside
-- show_on_events_page/show_on_homepage (20260825100000).
--
-- card_kind is presentation-only - it must never be read by the publish
-- gate (checkPublishGate in admin/api/featured-programs/route.ts), which
-- is instead bypassed off show_on_term_page there, since term-program
-- cards don't use the Quote & Pricing Engine at all.
alter table featured_programs
  add column age_label text,
  add column fee_label text,
  add column spots_label text,
  add column status_label text,
  add column card_kind text not null default 'session'
    check (card_kind in ('session', 'interest', 'term')),
  add column show_on_term_page boolean not null default false;
