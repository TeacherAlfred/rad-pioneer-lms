-- Closes the gap flagged in RAD_Academy_Featured_Programs_Seed_Data.md:
-- the website (featured_programs) and WhatsApp (bot_flows.message_body)
-- held two independently-typed copies of the same event dates, with
-- nothing keeping them in sync. A date changed on the website never
-- updated what the bot said, and vice versa.
--
-- Fix: bot_flows can now link to the featured_programs row it's
-- describing. The webhook (whatsapp-webhook/route.ts runBotFlow) resolves
-- a {{dates}} token in message_body against that row's date_options at
-- send time, reusing the exact same admin-authored date labels the
-- website already shows - one place to edit a date (Featured Programs),
-- not two. {{location}} and {{title}} tokens are also available for the
-- same reason.
alter table bot_flows
  add column if not exists featured_program_id uuid references featured_programs(id);

-- Seed the four current live offerings. Two are fully confirmed
-- (Polokwane, Online Term Lessons) and inserted complete, per
-- RAD_Academy_Featured_Programs_Seed_Data.md. Pretoria and the Webinar
-- have real fields still pending real numbers (exact Pretoria date, next
-- webinar session, all four images) - per that doc's own instruction not
-- to let a developer fill those with a guess, they're inserted with an
-- empty date_options (renders as "dates to be confirmed" via {{dates}}
-- rather than a fabricated date) and a generous placeholder live_until,
-- not a real one. Flagged clearly to the user as still needing input.
-- Each insert is guarded by title so re-running this migration (this
-- project pastes migrations by hand rather than tracking what's already
-- applied) doesn't create duplicate program cards.
insert into featured_programs
  (title, label, location, details, duration, form_label, image_url, is_video, accent, sort_order, live_from, live_until, date_options)
select
  'Pretoria Robotics Workshop', 'Workshop', 'Pretoria',
  'Real hardware, small groups. Your child builds a working circuit and takes home the skills that got them there.',
  '3 hours', 'Hold My Spot', '/logo/rad-logo_white_2.png', false, 'bg-rad-blue', 1,
  now(), now() + interval '45 days', '[]'::jsonb
where not exists (select 1 from featured_programs where title = 'Pretoria Robotics Workshop');

insert into featured_programs
  (title, label, location, details, duration, form_label, image_url, is_video, accent, sort_order, live_from, live_until, date_options)
select
  'Polokwane Robotics Circuit', 'Workshop', 'Polokwane',
  'Two-day hands-on robotics circuit, right before Term 4 starts. Real components, real skills, before the holidays end.',
  '2 days', 'Hold My Spot', '/logo/rad-logo_white_2.png', false, 'bg-rad-blue', 2,
  now(), '2026-10-04T23:59:00+02:00'::timestamptz,
  '[
    {"id": "2026-10-03", "label": "Saturday, 3 October", "starts_at": "2026-10-03T09:00:00+02:00"},
    {"id": "2026-10-04", "label": "Sunday, 4 October", "starts_at": "2026-10-04T09:00:00+02:00"}
  ]'::jsonb
where not exists (select 1 from featured_programs where title = 'Polokwane Robotics Circuit');

insert into featured_programs
  (title, label, location, details, duration, form_label, image_url, is_video, accent, sort_order, live_from, live_until, date_options)
select
  'Online Robotics & Coding Webinar', 'Webinar', 'Online',
  '45 minutes, live and hands-on - from the Minecraft logic your child already knows to a real robotics build, from anywhere.',
  '45 minutes', 'Register Me', '/logo/rad-logo_white_2.png', false, 'bg-rad-teal', 3,
  now(), '2027-01-31T23:59:00+02:00'::timestamptz, '[]'::jsonb
where not exists (select 1 from featured_programs where title = 'Online Robotics & Coding Webinar');

insert into featured_programs
  (title, label, location, details, duration, form_label, image_url, is_video, accent, sort_order, live_from, live_until, date_options)
select
  'Online Term Lessons', 'Term Programme', 'Online',
  'Weekly online coding and robotics lessons, running the full term - the next step after the workshop or webinar.',
  'Weekly, full term', 'Reserve My Spot', '/logo/rad-logo_white_2.png', false, 'bg-rad-purple', 4,
  now(), '2026-10-03T23:59:00+02:00'::timestamptz,
  '[{"id": "term4-2026", "label": "Term 4 - starts 6 October", "starts_at": "2026-10-06T00:00:00+02:00"}]'::jsonb
where not exists (select 1 from featured_programs where title = 'Online Term Lessons');

-- Link the matching WhatsApp flows and switch their date text over to the
-- {{dates}} token - wording otherwise kept close to what was already live.
update bot_flows set
  featured_program_id = (select id from featured_programs where title = 'Polokwane Robotics Circuit'),
  message_body = 'Two-day Robotics Circuit — {{dates}}, right before Term 4 starts.

Want to hold a seat?'
where trigger_button_id = 'btn_polokwane';

update bot_flows set
  featured_program_id = (select id from featured_programs where title = 'Pretoria Robotics Workshop'),
  message_body = 'Robotics Sessions coming up: {{dates}}.

Real hardware, small groups. Want to hold a seat?'
where trigger_button_id = 'btn_pretoria';

update bot_flows set
  featured_program_id = (select id from featured_programs where title = 'Online Robotics & Coding Webinar'),
  message_body = 'Our next live session: {{dates}} — 45 minutes, hands-on, from anywhere. Want me to hold you a spot?'
where trigger_button_id = 'btn_webinar';
