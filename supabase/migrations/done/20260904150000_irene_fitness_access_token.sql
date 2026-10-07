-- A durable, shareable "my link" per family - /projects/irene-fitness/me/
-- {access_token} lets a family edit their response or grab a vote-only link
-- to share further, without needing their original device's cookie. The
-- slug half (from their response's display_name) makes the link readable
-- and easy to say over WhatsApp; the random suffix is the actual security
-- boundary, since the slug alone would be guessable.
alter table irene_fitness_families
  add column access_token text;

update irene_fitness_families f
set access_token = (
  select
    regexp_replace(
      regexp_replace(lower(coalesce(r.display_name, 'family')), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) || '-' || substr(md5(random()::text || f.id::text), 1, 6)
  from irene_fitness_responses r
  where r.family_id = f.id
)
where access_token is null;

-- Families with no response row yet (registered but never got to the story
-- step) still need a usable token - falls back to a generic slug.
update irene_fitness_families
set access_token = 'family-' || substr(md5(random()::text || id::text), 1, 8)
where access_token is null;

alter table irene_fitness_families
  add constraint irene_fitness_families_access_token_key unique (access_token);

alter table irene_fitness_families
  alter column access_token set not null;
