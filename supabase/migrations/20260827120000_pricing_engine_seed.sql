-- Quote & Pricing Engine, part 2: illustrative seed data (spec §9) plus the
-- default quote email template, featured_programs backfill, and
-- systems_status tracking entries for this build.
--
-- Everything final_fee-bearing here is seeded with published = false and
-- featured_program_id = null (unattached) - per the spec's explicit caveat
-- that §9's numbers are illustrative, not real costs, and per the founder's
-- requirement that attaching a package to a real program is a compulsory,
-- explicit admin step (see the pricing wizard's "Packages & Quote Email"
-- section on the featured-programs edit form), not something a migration
-- should do on the admin's behalf.

-- The webinar is explicitly "not tiered - a single standalone package" per
-- spec §9.1, so tier_role must allow null (missed in the first pass of
-- 20260827110000_pricing_engine_core.sql, which had it not-null).
alter table event_packages alter column tier_role drop not null;

do $$
declare
  -- Inventory item ids
  i_founder_webinar uuid;
  i_venue_pretoria uuid;
  i_educator_halfday uuid;
  i_snacks uuid;
  i_workbook uuid;
  i_minecraft_workshop uuid;
  i_educator_online uuid;
  i_minecraft_monthly uuid;
  i_platform_hosting uuid;
  i_roadmap uuid;
  i_exec_mentor uuid;
  i_monthly_discussion uuid;

  -- Package ids
  p_webinar uuid;
  p_workshop_only uuid;
  p_workshop_bundle uuid;
  p_term_lessons uuid;
  p_priority uuid;

  -- Default quote email template id
  t_default uuid;
begin
  -- 1. Inventory items (spec §9)
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Founder time — webinar hosting', 'staffing', 'flat', 500, 'per event') returning id into i_founder_webinar;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Venue hire — Pretoria half-day', 'venue', 'flat', 1500, 'per event') returning id into i_venue_pretoria;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Educator time — half day', 'staffing', 'flat', 1200, 'per event') returning id into i_educator_halfday;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Snacks, per child', 'catering', 'per_unit', 40, 'per child') returning id into i_snacks;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Workbook & materials, per child', 'materials', 'per_unit', 60, 'per child') returning id into i_workbook;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Minecraft Education seat licence — workshop', 'licensing', 'per_unit', 25, 'per child') returning id into i_minecraft_workshop;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label, notes) values
    ('Educator time — online session', 'staffing', 'per_unit', 60, 'per child, per session', 'Reused across Term Lessons and the Priority tier - do not duplicate.') returning id into i_educator_online;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label, notes) values
    ('Minecraft Education seat licence — monthly', 'licensing', 'per_unit', 25, 'per child, per month', 'Reused across Term Lessons and the Priority tier - do not duplicate.') returning id into i_minecraft_monthly;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Platform & hosting', 'other', 'flat', 400, 'per month') returning id into i_platform_hosting;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Personalised roadmap & action plan', 'mentorship', 'flat', 600, 'per child, per month') returning id into i_roadmap;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Executive mentor facilitation', 'mentorship', 'flat', 300, 'per child, per month') returning id into i_exec_mentor;
  insert into inventory_items (name, category, cost_type, unit_cost, unit_label) values
    ('Monthly discussion session (founder time)', 'staffing', 'flat', 500, 'per child, per month') returning id into i_monthly_discussion;

  -- 2. Packages + composition (spec §9)
  insert into packages (name, event_type, description, child_facing_blurb) values
    ('Webinar — Info Session', 'webinar', 'A free live session for parents to learn what RAD Academy offers and how it fits their child.', null)
    returning id into p_webinar;
  insert into package_items (package_id, inventory_item_id, quantity_type) values (p_webinar, i_founder_webinar, 'flat');

  insert into packages (name, event_type, description, child_facing_blurb) values
    ('Pretoria Workshop — Half Day', 'workshop', 'A hands-on half-day workshop introducing your child to game-based learning and creative problem-solving.', 'Come build something real with us for a day.')
    returning id into p_workshop_only;
  insert into package_items (package_id, inventory_item_id, quantity_type) values
    (p_workshop_only, i_venue_pretoria, 'flat'),
    (p_workshop_only, i_educator_halfday, 'flat'),
    (p_workshop_only, i_snacks, 'per_child'),
    (p_workshop_only, i_workbook, 'per_child'),
    (p_workshop_only, i_minecraft_workshop, 'per_child');

  insert into packages (name, event_type, description, child_facing_blurb) values
    ('Pretoria Workshop + Term Pass', 'workshop', 'The half-day workshop plus a full month of weekly online lessons to keep the momentum going afterwards.', 'One great day, then four more weeks of it.')
    returning id into p_workshop_bundle;
  insert into package_items (package_id, inventory_item_id, quantity_type, quantity_override) values
    (p_workshop_bundle, i_venue_pretoria, 'flat', null),
    (p_workshop_bundle, i_educator_halfday, 'flat', null),
    (p_workshop_bundle, i_snacks, 'per_child', null),
    (p_workshop_bundle, i_workbook, 'per_child', null),
    (p_workshop_bundle, i_minecraft_workshop, 'per_child', null),
    (p_workshop_bundle, i_educator_online, 'per_child', 4),
    (p_workshop_bundle, i_minecraft_monthly, 'per_child', null),
    (p_workshop_bundle, i_platform_hosting, 'flat', null);

  insert into packages (name, event_type, description, child_facing_blurb) values
    ('Term Lessons — Monthly', 'term_lessons', 'Weekly online lessons that build steadily on what your child already knows, month after month.', 'Every week, a little more than you knew last week.')
    returning id into p_term_lessons;
  insert into package_items (package_id, inventory_item_id, quantity_type, quantity_override) values
    (p_term_lessons, i_educator_online, 'per_child', 4),
    (p_term_lessons, i_minecraft_monthly, 'per_child', null),
    (p_term_lessons, i_platform_hosting, 'flat', null);

  -- Priority Coaching: every item is quantity_type per_child even where the
  -- underlying inventory item is cost_type flat - spec §9.4, each child gets
  -- their own roadmap/mentor/session, so nothing here is genuinely shared.
  insert into packages (name, event_type, description, child_facing_blurb) values
    ('Priority — Education Excellence Coaching', 'priority_coaching', 'Personalised, high-touch coaching toward your child''s own academic and career direction - usable from primary school through high school, not just for matrics.', 'Your own roadmap, your own mentor, built around you.')
    returning id into p_priority;
  insert into package_items (package_id, inventory_item_id, quantity_type, quantity_override) values
    (p_priority, i_roadmap, 'per_child', null),
    (p_priority, i_exec_mentor, 'per_child', null),
    (p_priority, i_monthly_discussion, 'per_child', null),
    (p_priority, i_educator_online, 'per_child', 4),
    (p_priority, i_minecraft_monthly, 'per_child', null);

  -- 3. Event-package pricing snapshots (spec §9's illustrative numbers).
  -- featured_program_id is deliberately null (unattached) - see file header.
  insert into event_packages (featured_program_id, package_id, tier_role, display_order, computed_cost, target_margin_pct, recommended_fee, final_fee, published, override_reason_category, margin_override_reason) values
    (null, p_webinar, null, 0, 16.67, null, null, 0, false, 'loss_leader_lead_gen', 'Top-of-funnel lead magnet, not a revenue product — free by design, not an error.'),
    (null, p_workshop_only, 'lighter', 1, 305, 40, 508, 510, false, null, null),
    (null, p_workshop_bundle, 'recommended', 2, 590, 50, 1180, 1180, false, null, null),
    (null, p_term_lessons, 'anchor', 0, 285, 60, 712.50, 715, false, null, null),
    (null, p_priority, 'anchor', 0, 1665, 65, 4757, 4750, false, null, null);

  -- 4. Default quote email template - required by featured_programs.
  --    quote_email_template_id (§3 publish gate). Uses the same {{baseUrl}}/
  --    {{docId}} token convention as the existing composer email action
  --    (src/app/admin/finance/composer/page.tsx).
  insert into email_templates (slug, name, subject, body_content) values (
    'quote_v2_default',
    'Quote v2 — Default (Please Customize)',
    'Your RAD Academy Quote',
    '<p>Hi {{name}},</p><p>Thanks for your interest — here''s what your package includes, and your quote is ready to view:</p><p><a href="{{baseUrl}}/quote-v2/{{docId}}">View your quote</a></p><p>This quote is valid for 48 hours. If anything needs adjusting, just let us know from the quote page — a real person will follow up.</p><p>— RAD Academy</p>'
  ) returning id into t_default;

  -- 5. Backfill: every already-live featured_program needs a quote email
  --    template so it isn't silently blocked by the new publish gate mid-flight,
  --    but flagged for the founder to actually write a real one per program.
  update featured_programs
  set quote_email_template_id = t_default, quote_email_template_needs_review = true
  where draft = false and quote_email_template_id is null;
end $$;

-- 6. Systems Status tracking entry for this build (see 20260826130000_
--    systems_status_tracking.sql for the pattern this follows).
insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('pricing_engine', 'Quote & Pricing Engine', 'Items inventory, package composition, margin-aware pricing wizard, and automatic self-serve quote generation/delivery so leads can self-select a package and get a real quote without waiting on an admin.', 'now', 7)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('pricing_engine', 'Items/package/event_package data model + guardrail constraint', 'done', 'inventory_items, packages, package_items, event_packages; DB-level check blocks a below-cost final_fee without an override reason.', 1),
  ('pricing_engine', 'Illustrative seed data (Webinar/Workshop/Term Lessons/Priority)', 'done', 'Seeded unattached (featured_program_id null) and unpublished — founder must attach + review via the wizard before anything goes live.', 2),
  ('pricing_engine', 'Admin: inventory + package composition UI (/admin/pricing)', 'not_started', null, 3),
  ('pricing_engine', 'Admin: compulsory attach-and-price + quote-email-template step on featured-programs, with publish gate', 'not_started', null, 4),
  ('pricing_engine', 'Public: self-serve package picker in Register Interest flow', 'not_started', null, 5),
  ('pricing_engine', 'Auto quote generation + WhatsApp/email send + admin notification', 'not_started', null, 6),
  ('pricing_engine', 'Quote page: itemized breakdown + Request-a-change (replacing public decline)', 'not_started', null, 7),
  ('pricing_engine', 'Server-side PDF (headless browser render of the live quote page)', 'not_started', null, 8)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
