-- Note-level tagging (separate from book-level rad_book_tags) - shares the
-- same rad_tags vocabulary so a tag means the same thing whether it's on a
-- book or an individual note. This is what the tag heat map counts against.
-- Named rad_book_note_tags (not rad_note_tags) because a table of that name
-- already exists live - a leftover, empty, unrelated dictionary table from
-- an earlier abandoned attempt (see rad_margin_notes/rad_highlights/
-- rad_note_tag_relations, all confirmed empty and unused). Left untouched
-- rather than reused or dropped, per the same call made for those tables.
create table rad_book_note_tags (
  note_id uuid not null references rad_book_notes(id) on delete cascade,
  tag_id uuid not null references rad_tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

alter table rad_book_note_tags enable row level security;

create policy "rad_book_note_tags_select"
  on rad_book_note_tags for select
  using (true);

create policy "rad_book_note_tags_all"
  on rad_book_note_tags for all
  using (true) with check (true);

-- Seasonal/thematic focus: tags the reader has deliberately pinned to the
-- forefront (e.g. "this month I'm focused on X") regardless of how many
-- notes carry them. Lives alongside the vault PIN in the same singleton
-- settings row.
alter table rad_reader_settings
  add column focus_tag_ids uuid[] not null default '{}';
