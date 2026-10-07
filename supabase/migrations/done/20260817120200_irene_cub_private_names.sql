-- Admin-only, optional per-child real name — deliberately a separate column from `cubs`
-- (which only holds cub_initial/grade/class_name and is selected in full by the public
-- irene-comrades voting page). Never add this to the public page's select list.
alter table irene_responses
  add column cub_full_names text[];
