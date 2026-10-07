-- Quote & Pricing Engine spec §16 ("Online Personalised Lessons"), first
-- real piece: a costed, quote-usable package for the 10-lesson bucket.
--
-- Costs cannot be apportioned per month for this product (lessons are
-- scheduled flexibly, ideally weekly but not on a fixed cadence) - so
-- unlike Term Lessons or the workshop packages, this has zero `flat`
-- items. Everything is `quantity_type: per_child`, matching how Priority
-- Coaching already models a genuinely 1:1 product (spec §9.4) - there is
-- no shared/apportioned cost here to go stale the way Pretoria Workshop's
-- flat venue cost did (see the staleness audit two builds ago).
--
-- The "10x" comes from unit_multiplier, not a new quantity mechanism: one
-- package definition priced per lesson, attached once at unit_multiplier
-- = 10 for this bucket - the same mechanism already proven on Pretoria
-- Workshop's "Single" (×1) vs "Multi-Workshop Pass" (×3) attachments. A
-- future 15- or 20-lesson bucket is just another attachment of this same
-- package at a different multiplier, not a new package.
--
-- Educator cost confirmed by the founder: R75/lesson (deliberately kept
-- lower than what genuine 1-on-1 delivery should eventually cost - a
-- 2027 pricing review item, not fixed here). final_fee (R2,250) is the
-- package's list price - the R2,000 upfront-payment discount is applied
-- per-quote in the Composer, not baked into the package.
-- packages.event_type is a genuine CHECK constraint (workshop, term_lessons,
-- priority_coaching, webinar) - personalized_lessons is a new product type,
-- per spec §16.1, needing its own margin band rather than reusing
-- term_lessons's cohort-sharing assumption.
alter table packages drop constraint packages_event_type_check;
alter table packages add constraint packages_event_type_check
  check (event_type in ('workshop', 'term_lessons', 'priority_coaching', 'webinar', 'personalized_lessons'));

do $$
declare
  i_educator_1on1 uuid;
  p_online_lessons uuid;
begin
  select id into i_educator_1on1 from inventory_items where name = 'Educator time — 1-on-1 lesson';
  if i_educator_1on1 is null then
    insert into inventory_items (name, category, cost_type, unit_cost, unit_label, notes)
    values ('Educator time — 1-on-1 lesson', 'staffing', 'per_session', 75, 'per lesson',
      'Deliberately kept at R75 for launch, same as the group per-student-per-month rate - true 1-on-1 delivery should cost more. Revisit in the 2027 pricing review (see spec §17).')
    returning id into i_educator_1on1;
  end if;

  select id into p_online_lessons from packages where name = 'Online Lessons — Per Lesson';
  if p_online_lessons is null then
    insert into packages (name, event_type, description, child_facing_blurb, active)
    values (
      'Online Lessons — Per Lesson',
      'personalized_lessons',
      'One-on-one online lessons with a dedicated educator, scheduled flexibly around your family - ideally weekly, but never locked to a fixed calendar cadence.',
      'Your very own online lesson time, just for you.',
      true
    )
    returning id into p_online_lessons;

    insert into package_items (package_id, inventory_item_id, quantity_type)
    values (p_online_lessons, i_educator_1on1, 'per_child');
  end if;

  if not exists (select 1 from event_packages where package_id = p_online_lessons and featured_program_id is null) then
    insert into event_packages (
      featured_program_id, package_id, tier_role, display_order, unit_multiplier,
      computed_cost, target_margin_pct, recommended_fee, final_fee, published
    ) values (
      null, p_online_lessons, null, 0, 10,
      750, 67.5, 2307.69, 2250, false
    );
  end if;
end $$;

-- personalized_lessons needs its own checklist entry updated - the
-- event_type + a real (fixed 10-lesson bucket) package now exist; the
-- fuller spec §16.2 mechanic (any quantity ≥10 in blocks of 5, chosen at
-- booking) is still not built.
update system_checklist_items
set state = 'partial',
    notes = 'Online Lessons — Per Lesson package built (personalized_lessons event_type, R75/lesson educator cost, global attachment at unit_multiplier=10 for the 10-lesson bucket, final_fee R2,250). Still needed: min_quantity(10)/quantity_increment(5) enforcement and pricing_model: per_unit so quantity can be chosen at booking instead of needing a new package attachment per bucket size, and a featured_programs card if/when this goes self-serve. Spec §16.'
where system_key = 'pricing_engine' and label = 'Online Lessons (1-on-1) — featured programme + per-unit pricing package';
