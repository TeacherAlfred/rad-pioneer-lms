-- Curriculum programme for the quantity-based, per-lesson online 1-on-1
-- product (Quote & Pricing Engine spec §16, "Online Personalised Lessons").
-- Quote-only for now, per explicit founder instruction: this is just the
-- required quotes.program_id target so a Composer quote for this product
-- can exist at all - no featured_programs card, no event_packages/pricing-
-- library wiring. The public-facing programme/package build (§16's
-- min_quantity/quantity_increment/per_unit pricing_model work) is
-- deferred, tracked below rather than silently left undone.
insert into programs (code, name, type, audience, active, description_short)
select 'OL1-101', 'Online Lessons', 'private', 'student', true,
  'One-on-one online lessons with an educator, booked in blocks of lessons (10 minimum, then +5).'
where not exists (
  select 1 from programs where code = 'OL1-101'
);

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select 'pricing_engine', 'Online Lessons (1-on-1) — featured programme + per-unit pricing package', 'not_started',
  'Quotes for this product are being created manually via the Composer against the "Online Lessons" programme (OL1-101) for now. Still needs: personalized_lessons event_type, min_quantity(10)/quantity_increment(5) enforcement, pricing_model: per_unit on packages (final_fee = price per lesson, not total), and a featured_programs card if/when this goes self-serve. Spec §16.', 10
where not exists (
  select 1 from system_checklist_items
  where system_key = 'pricing_engine' and label = 'Online Lessons (1-on-1) — featured programme + per-unit pricing package'
);
