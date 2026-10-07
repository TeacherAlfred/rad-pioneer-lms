-- Admin "merge two leads into one" tool.
--
-- Deliberately never hard-deletes the losing row. Several tables that
-- reference leads.id (messages, lead_stage_history) predate this repo's
-- migration history, so their exact FK/ON DELETE behavior can't be
-- verified here - a hard delete risks either an FK violation (annoying
-- but safe) or, worse, a silent ON DELETE CASCADE wiping history on a
-- table this migration doesn't know to repoint first. Instead the loser
-- row is kept and flagged via merged_into_id/merged_at, and every
-- known referencing table is repointed onto the survivor. Admin list
-- views should filter out merged_into_id is not null.
--
-- backup_email/backup_phone hold the non-chosen contact value when the
-- admin picks "keep both" instead of picking a winner (SOP: primary +
-- backup, not forced either/or, for exactly this reason).

alter table leads
  add column if not exists backup_email text,
  add column if not exists backup_phone text,
  add column if not exists merged_into_id uuid references leads(id),
  add column if not exists merged_at timestamptz;

create index if not exists leads_merged_into_id_idx on leads(merged_into_id);

-- p_fields carries only the curated, admin-pickable columns (identity/
-- contact/interest fields where a human judgment call makes sense).
-- Everything else that could differ between the two rows is merged here
-- automatically with a fixed, safe rule - not exposed as a per-field
-- picker, since second-guessing e.g. lifecycle_stage or lifetime_value
-- needs the same care as everywhere else those fields are touched
-- (lifecycle_stage must never regress - see 20260817120000_lead_lifecycle_model.sql):
--   tags / children_names  -> union, deduped
--   is_customer / opted_out / is_potential_student -> OR (true wins,
--     matches "never silently un-flag" from the opted_out precedent)
--   first_purchase_at -> earliest, last_purchase_at -> latest
--   lifetime_value -> coalesce (never summed - no reliable way to tell
--     whether two recorded values are additive or a duplicate of the
--     same purchase)
create or replace function merge_leads(p_survivor_id uuid, p_loser_id uuid, p_fields jsonb)
returns void
language plpgsql
as $$
begin
  if p_survivor_id = p_loser_id then
    raise exception 'Cannot merge a lead into itself';
  end if;

  -- Every curated field below is applied exactly as picked - including
  -- clearing it to empty if the admin explicitly picked a side that was
  -- blank - rather than silently falling back to the survivor's existing
  -- value. The client always sends a fully-resolved value for every field
  -- on every call, so "field present but blank" is a deliberate choice,
  -- not a partial update to protect against. leads.phone is NOT NULL, so
  -- that one column alone falls back to '' rather than NULL.
  update leads set
    name = case when p_fields ? 'name' then nullif(p_fields->>'name', '') else name end,
    email = case when p_fields ? 'email' then nullif(p_fields->>'email', '') else email end,
    phone = case when p_fields ? 'phone' then coalesce(nullif(p_fields->>'phone', ''), '') else phone end,
    backup_email = case when p_fields ? 'backup_email' then nullif(p_fields->>'backup_email', '') else backup_email end,
    backup_phone = case when p_fields ? 'backup_phone' then nullif(p_fields->>'backup_phone', '') else backup_phone end,
    school = case when p_fields ? 'school' then nullif(p_fields->>'school', '') else school end,
    class = case when p_fields ? 'class' then nullif(p_fields->>'class', '') else class end,
    source = case when p_fields ? 'source' then nullif(p_fields->>'source', '') else source end,
    household_id = case when p_fields ? 'household_id' then nullif(p_fields->>'household_id', '')::uuid else household_id end,
    -- preferred_channel is NOT NULL with a whatsapp/email check constraint
    -- (20260821120000_register_interest_form.sql), so this one field stays
    -- coalesce-to-existing rather than clearable - there's no valid "blank"
    -- value for it to fall back to.
    preferred_channel = coalesce(p_fields->>'preferred_channel', preferred_channel),
    number_of_children = case when p_fields ? 'number_of_children' then (p_fields->>'number_of_children')::int else number_of_children end,
    interested_program_id = case when p_fields ? 'interested_program_id' then nullif(p_fields->>'interested_program_id', '')::uuid else interested_program_id end,
    interested_date_label = case when p_fields ? 'interested_date_label' then nullif(p_fields->>'interested_date_label', '') else interested_date_label end,
    tags = (
      select coalesce(array_agg(distinct t), '{}')
      from unnest(coalesce((select l.tags from leads l where l.id = p_survivor_id), '{}')
               || coalesce((select l.tags from leads l where l.id = p_loser_id), '{}')) as t
    ),
    children_names = (
      select coalesce(array_agg(distinct c), '{}')
      from unnest(coalesce((select l.children_names from leads l where l.id = p_survivor_id), '{}')
               || coalesce((select l.children_names from leads l where l.id = p_loser_id), '{}')) as c
    ),
    is_potential_student = is_potential_student or coalesce((select l.is_potential_student from leads l where l.id = p_loser_id), false),
    opted_out = opted_out or coalesce((select l.opted_out from leads l where l.id = p_loser_id), false),
    is_customer = is_customer or coalesce((select l.is_customer from leads l where l.id = p_loser_id), false),
    first_purchase_at = least(first_purchase_at, (select l.first_purchase_at from leads l where l.id = p_loser_id)),
    last_purchase_at = greatest(last_purchase_at, (select l.last_purchase_at from leads l where l.id = p_loser_id)),
    lifetime_value = coalesce(lifetime_value, (select l.lifetime_value from leads l where l.id = p_loser_id))
  where id = p_survivor_id;

  -- kid_guardians has unique(kid_id, lead_id) - if both leads are already
  -- guardians of the same kid, repointing the loser's row would collide
  -- with the survivor's existing one, so drop the now-redundant duplicate
  -- first rather than letting the update below fail.
  delete from kid_guardians kg_loser
  where kg_loser.lead_id = p_loser_id
    and exists (
      select 1 from kid_guardians kg_survivor
      where kg_survivor.lead_id = p_survivor_id and kg_survivor.kid_id = kg_loser.kid_id
    );

  update kid_guardians set lead_id = p_survivor_id where lead_id = p_loser_id;
  update lead_activities set lead_id = p_survivor_id where lead_id = p_loser_id;
  update lead_notes set lead_id = p_survivor_id where lead_id = p_loser_id;
  update lead_stage_history set lead_id = p_survivor_id where lead_id = p_loser_id;
  update admin_notification_buffer set lead_id = p_survivor_id where lead_id = p_loser_id;
  update orders set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update passes set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update consent_forms set guardian_id = p_survivor_id where guardian_id = p_loser_id;
  update guardian_consent_tokens set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update photo_gallery_tokens set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update messages set lead_id = p_survivor_id where lead_id = p_loser_id;

  -- leads.email carries a live unique constraint (leads_email_unique) not
  -- reflected anywhere in this repo's migration history - same story as
  -- leads.phone's NOT NULL, discovered the same way. The loser row is kept
  -- (see the file header for why) but still holds its original email/phone
  -- until cleared here - left alone, the exact case this tool exists for
  -- (two rows already sharing an email/phone) trips that constraint the
  -- moment the survivor's chosen value matches what the loser still has.
  -- phone is NOT NULL, so it gets an obviously-dead placeholder instead of
  -- NULL or '' (either of which could itself collide across merges if
  -- there's an equivalent unique constraint on phone).
  update leads set
    merged_into_id = p_survivor_id,
    merged_at = now(),
    email = null,
    phone = 'merged-' || p_loser_id::text
  where id = p_loser_id;
end;
$$;
