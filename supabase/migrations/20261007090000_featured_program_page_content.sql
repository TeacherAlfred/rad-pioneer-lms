-- Optional rich content for a program's /events/[id] detail page - the
-- extra sections a printed/WhatsApp flyer carries that the plain card
-- columns (title/details/location/duration/date_options) can't: an
-- eyebrow line, a headline with highlighted words, "what your child
-- learns" items, a take-home card, a parent quote and a group-size note.
-- First used for the October Robotics Workshop flyer, but deliberately a
-- generic per-row blob (admin-edited at /admin/featured-programs) so the
-- next flyer is data entry, not a new hardcoded page like
-- /events/robotics-workshop.
--
-- Presentation-only, every key optional - '{}' (the default) renders the
-- detail page from the existing columns alone, so no current row changes.
-- Shape (see FeaturedProgramPageContent in src/lib/featuredProgramPageContent.ts):
--   { eyebrow, headline, subheading, learn_items: [{title, desc}],
--     takeaway: {label, title, desc}, quote, scarcity_note }
alter table featured_programs
  add column page_content jsonb not null default '{}'::jsonb;
