-- Adds "I need help" ping support to Code the Block.
-- Run this in the same Supabase project (SQL editor) as schema.sql, after it.

alter table ctb_students
  add column needs_help boolean not null default false,
  add column help_module text,
  add column help_track text,
  add column help_requested_at timestamptz;
