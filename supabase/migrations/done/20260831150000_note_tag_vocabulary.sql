-- Note tag vocabulary (v1): a closed, two-tier controlled vocabulary for
-- note-level tagging, replacing free-form invention with pick-from-a-list.
-- "domain" = what the note is about (0-2 per note, enforced in
-- updateNoteTags). "function" = what to do with the note (0-1 per note).
-- Existing book-level tags (robotics, edtech, etc.) are left with category
-- null - they stay usable for whole-book tagging, unaffected by this.

alter table rad_tags add column category text null
  constraint rad_tags_category_check check (category in ('domain', 'function'));

-- Names were previously unrestricted; confirmed no duplicates exist today.
-- Needed so the seed below can upsert idempotently across repeated pushes.
create unique index if not exists rad_tags_name_key on rad_tags (name);

insert into rad_tags (name, category) values
  ('systems-thinking', 'domain'),
  ('finance', 'domain'),
  ('marketing', 'domain'),
  ('sales', 'domain'),
  ('business-systems', 'domain'),
  ('customer-psychology', 'domain'),
  ('vip', 'function'),
  ('apply-to-rad', 'function'),
  ('revisit', 'function'),
  ('quote-worth-keeping', 'function')
on conflict (name) do update set category = excluded.category;
