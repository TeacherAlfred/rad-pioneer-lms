-- Fills in the fields 20260822120000_bot_flow_program_sync.sql deliberately
-- left unconfirmed rather than guessing. Run after that migration - these
-- are updates against rows it inserts.

-- Pretoria: two real dates, both already the day-of-week/date pairing
-- used in the flow's original hand-typed copy ("Sat 29 August OR Sunday
-- 6 September"), now the source of truth instead of retyped text.
-- live_until pushed out to the later of the two sessions so the card
-- doesn't disappear before the second date has happened.
update featured_programs set
  live_until = '2026-09-06T23:59:00+02:00'::timestamptz,
  date_options = '[
    {"id": "2026-08-29", "label": "Saturday, 29 August", "starts_at": "2026-08-29T09:00:00+02:00"},
    {"id": "2026-09-06", "label": "Sunday, 6 September", "starts_at": "2026-09-06T09:00:00+02:00"}
  ]'::jsonb
where title = 'Pretoria Robotics Workshop';

-- Webinar: no confirmed session yet - a single "join the waiting list"
-- entry rather than leaving date_options empty, so a lead can still
-- register interest and land on the list instead of seeing no way to
-- proceed. Whenever a real date is confirmed, replace this entry (or add
-- alongside it) in /admin/featured-programs - no code change needed.
update featured_programs set
  date_options = '[
    {"id": "waitlist", "label": "Date TBA — Join Waiting List", "starts_at": "2026-12-31T00:00:00+02:00"}
  ]'::jsonb
where title = 'Online Robotics & Coding Webinar';

-- Reworded slightly so it reads naturally whether {{dates}} resolves to a
-- real date or the waitlist label above (the original phrasing doubled up
-- awkwardly on em dashes with "Date TBA — Join Waiting List" inline).
update bot_flows set
  message_body = 'Our next live session: {{dates}}

45 minutes, hands-on, from anywhere. Want me to hold you a spot?'
where trigger_button_id = 'btn_webinar';

-- Temporary placeholder image (an existing marketing flyer asset) for all
-- four programs, replacing the RAD-logo placeholder, until real photos
-- for each are ready.
update featured_programs set
  image_url = 'https://pub-5baa3fb9dc2549008c18dac88b524ed9.r2.dev/marketing_material/flyers/What_if_step-counter.jpg'
where title in (
  'Pretoria Robotics Workshop',
  'Polokwane Robotics Circuit',
  'Online Robotics & Coding Webinar',
  'Online Term Lessons'
);
