-- Parent vs student is now one answer kept in step in four places (see
-- src/lib/leadRole.ts): leads.is_confirmed_parent, leads.is_potential_student,
-- the segment_parent / segment_student tags, and the respondent_is_parent
-- qualification check. New writes go through one helper; this brings the
-- EXISTING rows in line so every screen shows the same thing.
--
-- Precedence when sources are combined (a dry run on 2026-09-25 found no
-- lead where they disagree, so this only fills the blanks):
--   admin's qualification answer > is_confirmed_parent > is_potential_student > bot tags
-- A failed check with detail 'too_old' is an adult, not a student, so it
-- doesn't decide the role. Nothing is disqualified or moved to Lost here; the
-- lifecycle stage is not touched.

with role_of as (
  select
    l.id,
    case
      when c.passed is true then 'parent'
      when c.passed is false and coalesce(c.detail, '') <> 'too_old' then 'student'
      when l.is_confirmed_parent then 'parent'
      when l.is_potential_student then 'student'
      when 'segment_parent' = any (coalesce(l.tags, '{}')) then 'parent'
      when 'segment_student' = any (coalesce(l.tags, '{}')) then 'student'
    end as role
  from leads l
  left join lead_qualification_checks c
    on c.lead_id = l.id and c.stage_key = 'respondent_is_parent'
  where l.merged_into_id is null
)
update leads l
set
  is_confirmed_parent = (r.role = 'parent'),
  is_potential_student = (r.role = 'student'),
  tags = (
    select coalesce(array_agg(distinct t), '{}')
    from unnest(
      array_remove(array_remove(coalesce(l.tags, '{}'), 'segment_parent'), 'segment_student')
      || case r.role when 'parent' then array['segment_parent'] else array['segment_student'] end
    ) as t
  )
from role_of r
where r.id = l.id
  and r.role is not null
  and (
    l.is_confirmed_parent is distinct from (r.role = 'parent')
    or l.is_potential_student is distinct from (r.role = 'student')
    or (r.role = 'parent' and not ('segment_parent' = any (coalesce(l.tags, '{}'))))
    or (r.role = 'student' and not ('segment_student' = any (coalesce(l.tags, '{}'))))
    or ('segment_parent' = any (coalesce(l.tags, '{}')) and r.role <> 'parent')
    or ('segment_student' = any (coalesce(l.tags, '{}')) and r.role <> 'student')
  );

-- Everyone now recorded as a parent also has the passed qualification check,
-- so Lead Journey agrees with the list. Existing checks are left as they are.
insert into lead_qualification_checks (lead_id, stage_key, passed, detail, checked_at, checked_by)
select l.id, 'respondent_is_parent', true, null, now(), 'role_sync'
from leads l
where l.is_confirmed_parent = true
  and l.merged_into_id is null
on conflict (lead_id, stage_key) do nothing;
