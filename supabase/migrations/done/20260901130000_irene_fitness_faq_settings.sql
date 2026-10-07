-- FAQ answers that change every season (results date, whether submissions
-- are still open) shouldn't need a redeploy - same "cosmetic only, no
-- automation tied to it" pattern as irene_settings.phase_ends_hint on the
-- older irene-comrades platform: plain nullable text, admin-edited, publicly
-- read, nothing computed against it.
alter table irene_fitness_voting_settings
  add column results_announcement_date text,
  add column submissions_open boolean not null default true;

-- Deferred per business-owner decision (SLA clock scope question, 2026-09-01):
-- ship the Fit Fam contact form on the existing needs_human "Needs Reply"
-- flag rather than building a new 24h countdown/overdue indicator now. Track
-- the real indicator as separate follow-up work rather than only in chat.
insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('admin', 'Fit Fam contact form 24h SLA countdown/overdue indicator', 'not_started', 'Contact form (leads.source = irene_fitfam_contact_form) ships on the existing needs_human "Needs Reply" badge - no real countdown or overdue timestamp exists anywhere in the admin yet. Deferred by choice, not an oversight: building one is net-new UI on the lead screens (Lead Journey Kanban or lead-funnel list), not just wiring into something pre-built.', 5);
