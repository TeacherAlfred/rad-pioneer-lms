-- Captures which chapter/section a note was taken in, resolved from the
-- book's own outline (PDF bookmarks) or table of contents (EPUB nav) at the
-- moment of highlighting. Nullable because not every PDF ships an outline -
-- notes on those just have no chapter, same as today.
alter table rad_book_notes add column chapter_title text null;
