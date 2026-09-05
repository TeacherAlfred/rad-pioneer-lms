-- Admin-editable text for every WhatsApp/email message a button in the
-- Irene Fitness portal can send - previously hardcoded in
-- responses/page.tsx (guide + my-link) and community/page.tsx's share
-- banner. {{name}} and {{link}} are the only substitutions app code
-- performs at send-time; nothing else in the template is touched, so an
-- admin can reword freely without breaking the system-generated parts.
create table irene_fitness_message_templates (
  key text primary key,
  label text not null,
  whatsapp_body text not null,
  email_subject text,
  email_body text,
  updated_at timestamptz not null default now()
);

insert into irene_fitness_message_templates (key, label, whatsapp_body, email_subject, email_body) values
(
  'guide',
  'Free parent guide (sent after marketing opt-in)',
  E'Good afternoon {{name}},\n\nThanks for joining the _Irene Primary Health & Wellness community_!\n\nAs promised, here''s RAD Academy''s free Parent''s Guide to Hacking Screen Time - a quick read on turning screen time into a real skill (yes, even Minecraft - and applies to any kids who spend time on a screen).\n\nNext week we''ll send a second free guide too - this one all about getting kids to understand how fitness devices work, a guide to go with the community you''ve just joined.\n\nNo strings attached, just something useful for your family 🙌',
  E'Your Free Parent\'s Guide to Hacking Screen Time',
  E'Good afternoon {{name}},\n\nThanks for joining the Irene Primary Health & Wellness community!\n\nAs promised, here''s RAD Academy''s free Parent''s Guide to Hacking Screen Time - a quick read on turning screen time into a real skill (yes, even Minecraft - and applies to any kids who spend time on a screen).\n\nNext week we''ll send a second free guide too - this one all about getting kids to understand how fitness devices work, a guide to go with the community you''ve just joined.\n\nNo strings attached, just something useful for your family 🙌\n\nBest regards,\nThe RAD Academy Team'
),
(
  'my_link',
  'Personal Fit Fam link (edit/share)',
  E'Hi {{name}}! Here''s your personal Fit Fam link - you can edit your entry or grab a link to share with friends & family for votes:\n\n{{link}}',
  'Your personal Fit Fam link',
  E'Hi {{name}}! Here''s your personal Fit Fam link - you can edit your entry or grab a link to share with friends & family for votes:\n\n{{link}}'
),
(
  'share_vote',
  'Ask friends & family to vote (public share button)',
  'Vote for {{name}} in the Irene Primary Fit Fam! {{link}}',
  null,
  null
);
