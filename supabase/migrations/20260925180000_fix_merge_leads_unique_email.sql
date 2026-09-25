-- Fix: merging two leads failed with
--   duplicate key value violates unique constraint "leads_email_unique"
--
-- merge_leads() wrote the chosen email/phone onto the SURVIVOR first, while
-- the LOSER row still held its original email/phone, and only cleared the
-- loser at the very end. Any merge where the kept email (or phone) is the one
-- currently on the other record - i.e. the normal case - tripped the unique
-- constraint. The old comment said the loser was cleared for exactly this
-- reason, but the clearing ran after the survivor update, too late.
--
-- Fix: clear the loser's email/phone FIRST. Safe because the caller always
-- sends the fully-resolved email/phone/backup values in p_fields (nothing is
-- read back from the loser's own email/phone), and the loser is hidden via
-- merged_into_id anyway. Everything else is unchanged from
-- 20260907230000_lead_call_queue.sql (Postgres can't alter a function body in
-- place, so the full function is restated).

create or replace function merge_leads(p_survivor_id uuid, p_loser_id uuid, p_fields jsonb)
returns void
language plpgsql
as $$
begin
  if p_survivor_id = p_loser_id then
    raise exception 'Cannot merge a lead into itself';
  end if;

  -- Free the loser's unique email/phone before the survivor may take either
  -- value. phone is NOT NULL, so it gets an obviously-dead placeholder.
  update leads set
    email = null,
    phone = 'merged-' || p_loser_id::text
  where id = p_loser_id;

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

  delete from lead_call_queue q_loser
  where q_loser.lead_id = p_loser_id and q_loser.status = 'pending'
    and exists (
      select 1 from lead_call_queue q_survivor
      where q_survivor.lead_id = p_survivor_id and q_survivor.status = 'pending'
    );
  update lead_call_queue set lead_id = p_survivor_id where lead_id = p_loser_id;

  update admin_notification_buffer set lead_id = p_survivor_id where lead_id = p_loser_id;
  update orders set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update passes set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update consent_forms set guardian_id = p_survivor_id where guardian_id = p_loser_id;
  update guardian_consent_tokens set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update photo_gallery_tokens set guardian_lead_id = p_survivor_id where guardian_lead_id = p_loser_id;
  update messages set lead_id = p_survivor_id where lead_id = p_loser_id;

  update leads set
    merged_into_id = p_survivor_id,
    merged_at = now()
  where id = p_loser_id;
end;
$$;
