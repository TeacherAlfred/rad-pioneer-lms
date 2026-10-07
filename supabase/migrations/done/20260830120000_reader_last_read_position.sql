-- Reader premium-UX redesign: persist an exact resume position per book,
-- separate from the existing 0-100 reading_progress percentage (which stays
-- driven by the manual "Log Progress" button). Page numbers are stable
-- across zoom/reflow for PDFs; EPUB CFI is epubjs's own precise location
-- string (already emitted by the `relocated` event, previously discarded).
-- last_read_at drives the "welcome back" moment on reopen and is written
-- alongside whichever of the two position columns applies to the book's
-- file_type - both are nullable since a book may have no digital file at all.
alter table rad_books
  add column last_page_number integer,
  add column last_cfi text,
  add column last_read_at timestamptz;
