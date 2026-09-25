-- Systems Status tracking for the public RAD Labs template (/labs/[slug]).
-- Data-only: the page itself is content-file driven and writes into the
-- existing leads / lead_activities / lead_notes tables, so no schema change.

insert into systems_status (key, title, purpose, priority_tier, sort_order) values
  ('rad_labs', 'RAD Labs (weekly self-paced labs)', 'Free public coding labs at /labs/[slug] - a lead magnet that captures WhatsApp opt-ins (next lab / workshop waitlist) and help requests into the lead funnel.', 'now', 10)
on conflict (key) do nothing;

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('rad_labs', 'Lab template page + typed content model (src/content/labs)', 'done', 'MakeCode Lab 01 ported from rad-lab-template.html. Add a lab = one content file + register in index.ts.', 1),
  ('rad_labs', 'Opt-in + waitlist -> leads (/api/labs/optin)', 'done', 'Phone-keyed upsert, tags lab_optin/lab_waitlist + role/grade, consent_marketing with wording version lab_optin_v1, admin WhatsApp alert.', 2),
  ('rad_labs', 'Help requests -> leads (/api/labs/help)', 'done', 'lead_notes + lead_activities row, needs_human = true, admin alert (urgent flagged).', 3),
  ('rad_labs', 'Real screenshots + AHA images for MakeCode Lab 01', 'not_started', 'Page shows labelled placeholders until Screenshot.src is set in makecode-01.ts.', 4),
  ('rad_labs', 'Send the next lab to opted-in numbers on WhatsApp', 'not_started', 'Opt-in only captures the lead today (tag lab_optin + lab:<slug>). Needs an approved template + a send job.', 5),
  ('rad_labs', 'Rate limiting on /api/labs/*', 'not_started', 'Honeypot + validation only; no rate-limit infrastructure exists in the repo yet.', 6),
  ('rad_labs', '/labs index page + decision on /labs vs /tutorials overlap', 'not_started', 'Both cover MakeCode. Decide whether Labs link into / supersede the Tutorial Hub.', 7),
  ('rad_labs', 'Admin/DB-backed lab editor', 'not_started', 'Later move off TS content files once the template stabilises.', 8)
) as v(system_key, label, state, notes, sort_order)
where not exists (
  select 1 from system_checklist_items existing
  where existing.system_key = v.system_key and existing.label = v.label
);
