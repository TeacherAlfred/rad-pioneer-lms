-- Tutorial Hub now has a nav entry (LeadsNavSidebar's new "Tutorial Hub"
-- group, /admin/tutorials added to AdminLeadsChrome's section prefixes) -
-- flip the discoverability item from not_started to done. Also logging the
-- new analytics_excluded_ips capability as its own done item since it's a
-- distinct, real feature (server-side IP exclusion for the Tutorial Hub
-- analytics aggregation, not just the existing per-browser dashboard filter).
update system_checklist_items
set state = 'done',
    notes = 'Added as its own group in LeadsNavSidebar.tsx (Series & Steps / Topic Votes / Hub Offer / Hub Analytics), with /admin/tutorials added to AdminLeadsChrome''s section prefixes so the sidebar actually renders there.',
    updated_at = now()
where system_key = 'lead_generation'
  and label = 'Tutorial Hub: admin nav discoverability';

insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('lead_generation', 'Tutorial Hub: time-on-step analytics + IP exclusion', 'done', 'Per-step dwell time tracked via a pause-on-background timer (tutorial_step_duration analytics_events), aggregated at /admin/tutorials/analytics with an outlier flag for steps running notably longer than a tutorial''s own average. New analytics_excluded_ips table lets an admin exclude their own/office IPs server-side from that aggregation - "exclude my IP" one-click plus manual entries.', 11);
