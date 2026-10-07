-- Now that the same package can be attached to one program more than once
-- at different unit_multiplier values (e.g. "Single Workshop" ×1 and
-- "Multi-Workshop Pass" ×3, same underlying composition), two attachments
-- of the same package would otherwise show identical name/description on
-- the public tier display - there was nowhere to differentiate them.
-- Nullable: falls back to the package's own name/description when unset,
-- so this is opt-in only where an admin actually needs to tell two
-- attachments of the same package apart.
alter table event_packages
  add column display_name text,
  add column display_description text;
