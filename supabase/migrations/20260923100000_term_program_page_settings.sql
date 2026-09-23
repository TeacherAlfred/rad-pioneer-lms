-- Term Program page (/term-program) banner copy, admin-editable so it can
-- be refreshed once a term without a code deploy. Same singleton-row,
-- null-means-"use the built-in default" convention as the welcome menu
-- columns (20260917090000_welcome_menu_settings.sql) - ships with zero
-- visual change until an admin actually edits something.
--
-- Distinct from the per-card content in featured_programs
-- (20260923090000_term_program_cards.sql), which changes throughout a
-- term's run-up as sessions get added/updated - these five columns are
-- the page's own hero/section copy, which only changes once per term.
alter table dashboard_settings
  add column if not exists term_program_hero_title text,
  add column if not exists term_program_hero_subtitle text,
  add column if not exists term_program_hero_image_url text,
  add column if not exists term_program_sessions_heading text,
  add column if not exists term_program_tbc_deadline_label text;
