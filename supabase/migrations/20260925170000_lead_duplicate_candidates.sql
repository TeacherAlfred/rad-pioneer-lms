-- Possible-duplicate leads, flagged for a human to review and merge.
--
-- Cause: imported contacts (warm list etc.) are stored in local format
-- (0738...), while WhatsApp/web forms store 27738.... Every phone lookup in
-- the app is an exact match on leads.phone, so the same person becomes two
-- lead rows. This only FLAGS pairs - nothing is edited, merged or deleted.
-- Merging stays a manual decision on /admin/lead-funnel/merge.

-- One canonical key per number: digits only, "00" international prefix
-- dropped, local 0XXXXXXXXX (10 digits) and bare XXXXXXXXX (9 digits)
-- expressed as 27XXXXXXXXX. Anything else is left as its digits.
create or replace function lead_phone_key(p text)
returns text
language sql
immutable
as $$
  select case
    when d = '' then null
    when length(d) = 10 and d like '0%' then '27' || substr(d, 2)
    when length(d) = 9 then '27' || d
    else d
  end
  from (
    select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', '') as d
  ) x
$$;

create table if not exists lead_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  lead_a_id uuid not null references leads(id) on delete cascade,
  lead_b_id uuid not null references leads(id) on delete cascade,
  reason text not null default 'same_phone_normalized',
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'merged')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Canonical ordering so the same pair can only ever be stored once.
  check (lead_a_id < lead_b_id),
  unique (lead_a_id, lead_b_id)
);

create index if not exists lead_duplicate_candidates_status_idx on lead_duplicate_candidates(status);

-- Same access model as the other admin-only tables: RLS on, no anon
-- policies, service role only.
alter table lead_duplicate_candidates enable row level security;

-- Safe to run any number of times. Adds newly-found pairs (a pair the admin
-- already dismissed stays dismissed - the unique key makes the insert a
-- no-op), and closes pending pairs where one side has since been merged away.
create or replace function refresh_lead_duplicate_candidates()
returns integer
language plpgsql
as $$
declare
  inserted integer;
begin
  update lead_duplicate_candidates c
  set status = 'merged', resolved_at = now()
  where c.status = 'pending'
    and exists (
      select 1 from leads l
      where l.id in (c.lead_a_id, c.lead_b_id) and l.merged_into_id is not null
    );

  with ins as (
    insert into lead_duplicate_candidates (lead_a_id, lead_b_id)
    select a.id, b.id
    from leads a
    join leads b
      on lead_phone_key(a.phone) = lead_phone_key(b.phone)
     and a.id < b.id
    where a.merged_into_id is null
      and b.merged_into_id is null
      and lead_phone_key(a.phone) is not null
    on conflict (lead_a_id, lead_b_id) do nothing
    returning 1
  )
  select count(*) into inserted from ins;

  return inserted;
end;
$$;

-- Backfill: flag everything that already exists.
select refresh_lead_duplicate_candidates();

-- Backlog: the cause (exact-match phone lookups) is not fixed by flagging.
insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes,
       (select coalesce(max(sort_order), 0) + 1 from system_checklist_items where system_key = v.system_key)
from (values
  ('lead_generation', 'Match leads on normalized phone at lookup time (stop creating 0738.../27738... duplicates)', 'not_started',
   'Duplicates are now flagged (lead_duplicate_candidates, /admin/lead-funnel/merge) but new ones keep appearing: every lookup is an exact .eq(''phone'') - whatsapp-webhook/route.ts, lib/labLeads.ts, term-program/register, irene-fitness/contact + submit, warm-list/commit, tutorials/link-phone. Fix = look up by lead_phone_key(), or normalize to 27... on every write incl. the warm-list importer.')
) as v(system_key, label, state, notes)
where exists (select 1 from systems_status where key = v.system_key)
  and not exists (
    select 1 from system_checklist_items existing
    where existing.system_key = v.system_key and existing.label = v.label
  );
