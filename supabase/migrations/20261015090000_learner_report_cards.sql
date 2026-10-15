-- Learner report cards - see "Learner Report Cards - Developer Spec"
-- (2026-10-15). Staff generate a draft from assessment data, edit the
-- wording, publish, and send each guardian a private /r/[token] link with
-- a PDF download.
--
-- Mapping onto the existing model (spec tables were examples only):
--   learners          -> kids (first name = first word of kids.name)
--   guardians         -> leads, via kid_guardians (+ receives_reports below)
--   programmes        -> programs (curriculum) + sessions (the dated run)
--   enrolments        -> enrolments (student on a session)
--   sessions/attendance -> lesson_attendance, keyed by lesson number on the
--                          enrolment, with sessions.lessons_planned. Lessons
--                          are recorded as exceptions (missed / caught up),
--                          so an untouched learner counts as fully attended.
--   staff_assignments -> not yet: staff access is the /admin allowlist
--                        (src/middleware.ts) until there's a teacher role.
--
-- Every table is RLS-enabled with zero anon policies, same as the consent,
-- kiosk and photo-gallery tables: the admin API (service role, behind the
-- /admin middleware) and the server-rendered /r/[token] page are the only
-- ways in. The browser never queries these tables directly.

-- ---------------------------------------------------------------------------
-- Enrolment and attendance
-- ---------------------------------------------------------------------------

alter table sessions add column if not exists lessons_planned integer;
comment on column sessions.lessons_planned is 'Number of lessons in this run (e.g. 5 for a 5-week school programme). Drives lessons-to-catch-up on learner reports.';

alter table kid_guardians add column if not exists receives_reports boolean not null default true;
comment on column kid_guardians.receives_reports is 'Guardian gets a private report link when a report for this kid is sent.';

create table lesson_attendance (
  enrolment_id uuid not null references enrolments(id) on delete cascade,
  lesson_no integer not null check (lesson_no > 0),
  present boolean not null,
  caught_up_on date,
  updated_at timestamptz not null default now(),
  primary key (enrolment_id, lesson_no)
);
alter table lesson_attendance enable row level security;

-- ---------------------------------------------------------------------------
-- Rubrics and assessment
-- ---------------------------------------------------------------------------

create table rubrics (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  label text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject, version)
);
alter table rubrics enable row level security;
create unique index rubrics_one_active_per_subject on rubrics(subject) where is_active;

create table rubric_areas (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references rubrics(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  unique (rubric_id, key)
);
alter table rubric_areas enable row level security;

-- rank: higher is better. Good = 2, Excellent = 3 leaves room for a
-- Developing = 1 level if the rubric ever grows one (spec open question).
create table rubric_levels (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references rubrics(id) on delete cascade,
  key text not null,
  label text not null,
  rank integer not null,
  unique (rubric_id, key),
  unique (rubric_id, rank)
);
alter table rubric_levels enable row level security;

create table rubric_descriptors (
  area_id uuid not null references rubric_areas(id) on delete cascade,
  level_id uuid not null references rubric_levels(id) on delete cascade,
  text text not null,
  primary key (area_id, level_id)
);
alter table rubric_descriptors enable row level security;

-- One assessment per enrolment (a programme run is one report period in v1).
create table assessments (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null unique references enrolments(id) on delete cascade,
  assessed_by text,
  assessed_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table assessments enable row level security;

create table assessment_scores (
  assessment_id uuid not null references assessments(id) on delete cascade,
  area_id uuid not null references rubric_areas(id) on delete cascade,
  level_id uuid not null references rubric_levels(id) on delete cascade,
  evidence_note text,
  primary key (assessment_id, area_id)
);
alter table assessment_scores enable row level security;

-- ---------------------------------------------------------------------------
-- Wording, reports and revisions
-- ---------------------------------------------------------------------------

-- fields: the template's wording per field, with {{placeholders}}.
--   strength:     {title, body, bigger_picture}
--   growth:       {title, now, next, home}
--   learner_note: {text}
--   whats_next:   {text}
-- conditions: {"all": [{"fact": "coding", "op": "eq", "value": "excellent"}],
--              "area": "robotics.wiring"}
--   An empty "all" always matches. "area" (growth only, optional) pins the
--   rubric area the goal is about; without it the learner's weakest area is
--   used. Lower priority is tried first. See
--   src/lib/reports/generate.ts for the facts and operators.
-- Saving a template inserts a new version and deactivates the old one, so
-- existing reports (which record template_key + template_version) never move.
create table narrative_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  section text not null check (section in ('strength', 'growth', 'learner_note', 'whats_next')),
  label text not null,
  fields jsonb not null,
  conditions jsonb not null default '{"all": []}'::jsonb,
  priority integer not null default 100,
  version integer not null default 1,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  unique (key, version)
);
alter table narrative_templates enable row level security;
create unique index narrative_templates_one_active_per_key on narrative_templates(key) where is_active;

-- status is the workflow state of the working copy. published_revision_id
-- is what a parent sees, and only moves on Approve / Publish correction, so
-- a correction draft never leaks to a parent link.
-- working_content is the autosave buffer: autosave writes here, explicit
-- Save / Submit / Approve append a report_revisions row.
create table reports (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references enrolments(id) on delete cascade,
  period_label text not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'sent')),
  current_revision_id uuid,
  published_revision_id uuid,
  working_content jsonb,
  working_updated_at timestamptz,
  review_comment text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrolment_id, period_label)
);
alter table reports enable row level security;
create index reports_enrolment_id_idx on reports(enrolment_id);

create table report_revisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  revision_no integer not null,
  content jsonb not null,
  change_note text,
  created_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  pdf_key text,
  unique (report_id, revision_no)
);
alter table report_revisions enable row level security;

alter table reports
  add constraint reports_current_revision_fk foreign key (current_revision_id) references report_revisions(id) on delete set null,
  add constraint reports_published_revision_fk foreign key (published_revision_id) references report_revisions(id) on delete set null;

-- Append-only: content and identity of a revision never change after
-- insert. Only the publish stamp and the stored PDF key may be filled in.
create or replace function report_revisions_immutable() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content
     or new.report_id is distinct from old.report_id
     or new.revision_no is distinct from old.revision_no
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.change_note is distinct from old.change_note then
    raise exception 'report_revisions are append-only';
  end if;
  return new;
end $$;

create trigger report_revisions_immutable
  before update on report_revisions
  for each row execute function report_revisions_immutable();

-- Written on publish from the report's area to grow, so the next report for
-- the same learner can say what changed (spec "Building on past reports").
create table growth_goals (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  report_id uuid not null references reports(id) on delete cascade,
  area_id uuid references rubric_areas(id) on delete set null,
  level_rank integer,
  text text not null,
  status text not null default 'open' check (status in ('open', 'achieved', 'carried')),
  closed_report_id uuid references reports(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (report_id)
);
alter table growth_goals enable row level security;
create index growth_goals_kid_id_idx on growth_goals(kid_id);

-- One private link per guardian per send. Only the SHA-256 of the token is
-- stored; the raw token exists only in the message we hand to staff.
create table report_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  guardian_lead_id uuid not null references leads(id) on delete cascade,
  token_hash text not null unique,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
alter table report_links enable row level security;
create index report_links_report_id_idx on report_links(report_id);

-- Audit trail and nurture signal. report_id is null for a failed link
-- attempt that matched nothing (still logged, per the POPIA rules).
create table report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  link_id uuid references report_links(id) on delete set null,
  actor_type text not null check (actor_type in ('staff', 'guardian', 'system')),
  actor_id text,
  event text not null,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
alter table report_events enable row level security;
create index report_events_report_id_idx on report_events(report_id, at desc);
create index report_events_failed_idx on report_events(event, at) where event = 'link_failed';

-- ---------------------------------------------------------------------------
-- Seed: the two rubrics from the assessment sheets
-- ---------------------------------------------------------------------------

with r as (
  insert into rubrics (subject, label, sort_order) values
    ('coding', 'Coding', 1),
    ('robotics', 'Robotics', 2)
  returning id, subject
),
lv as (
  insert into rubric_levels (rubric_id, key, label, rank)
  select r.id, l.key, l.label, l.rank
  from r cross join (values ('good', 'Good', 2), ('excellent', 'Excellent', 3)) as l(key, label, rank)
  returning id, rubric_id, key
),
ar as (
  insert into rubric_areas (rubric_id, key, label, sort_order)
  select r.id, a.key, a.label, a.sort_order
  from r join (values
    ('coding', 'understanding', 'Understanding the code', 1),
    ('coding', 'components', 'Code components', 2),
    ('coding', 'compiling', 'Compiling / running code', 3),
    ('coding', 'debugging', 'Debugging', 4),
    ('coding', 'practical', 'Practical coding', 5),
    ('robotics', 'identification', 'Component identification', 1),
    ('robotics', 'understanding', 'Understanding components', 2),
    ('robotics', 'wiring', 'Wiring', 3),
    ('robotics', 'circuits', 'Circuit understanding', 4),
    ('robotics', 'practical', 'Practical robotics', 5)
  ) as a(subject, key, label, sort_order) on a.subject = r.subject
  returning id, rubric_id, key
)
insert into rubric_descriptors (area_id, level_id, text)
select ar.id, lv.id, d.text
from ar
join r on r.id = ar.rubric_id
join lv on lv.rubric_id = ar.rubric_id
join (values
  ('coding', 'understanding', 'excellent', 'Clearly explains what the code does'),
  ('coding', 'understanding', 'good', 'Understands most of the code'),
  ('coding', 'components', 'excellent', 'Knows what each part/command does'),
  ('coding', 'components', 'good', 'Knows most components'),
  ('coding', 'compiling', 'excellent', 'Can compile/run code independently'),
  ('coding', 'compiling', 'good', 'Can compile/run with some assistance'),
  ('coding', 'debugging', 'excellent', 'Finds and fixes errors independently'),
  ('coding', 'debugging', 'good', 'Can identify some errors'),
  ('coding', 'practical', 'excellent', 'Can create/modify code independently'),
  ('coding', 'practical', 'good', 'Can complete tasks with some guidance'),
  ('robotics', 'identification', 'excellent', 'Identifies components correctly'),
  ('robotics', 'identification', 'good', 'Identifies most components'),
  ('robotics', 'understanding', 'excellent', 'Clearly explains what each component does'),
  ('robotics', 'understanding', 'good', 'Understands the main functions'),
  ('robotics', 'wiring', 'excellent', 'Wires components correctly and independently'),
  ('robotics', 'wiring', 'good', 'Wires correctly with some guidance'),
  ('robotics', 'circuits', 'excellent', 'Understands how components connect and communicate'),
  ('robotics', 'circuits', 'good', 'Understands basic connections'),
  ('robotics', 'practical', 'excellent', 'Builds/tests independently'),
  ('robotics', 'practical', 'good', 'Completes tasks with some guidance')
) as d(subject, area_key, level_key, text)
  on d.subject = r.subject and d.area_key = ar.key and d.level_key = lv.key;

-- ---------------------------------------------------------------------------
-- Seed: narrative templates (wording from the prototype)
-- ---------------------------------------------------------------------------

insert into narrative_templates (key, section, label, priority, conditions, fields) values
('strength.debugging', 'strength', 'Debugging', 10,
  '{"all": [{"fact": "coding", "op": "eq", "value": "excellent"}]}',
  jsonb_build_object(
    'title', 'Finds and fixes their own bugs',
    'body', '{{first_name}} can read a program, explain what each command does, and track down errors without being shown where they are.',
    'bigger_picture', 'Debugging is diagnosis. When something breaks, {{first_name}} looks for the cause instead of guessing. Engineers use this habit on failing systems, doctors on symptoms, and managers on missed targets. The young adult who stays calm and methodical when things go wrong is the one people trust with bigger problems.')),
('strength.systems', 'strength', 'Systems thinking', 20,
  '{"all": [{"fact": "robotics", "op": "eq", "value": "excellent"}]}',
  jsonb_build_object(
    'title', 'Sees how the parts work as a system',
    'body', '{{first_name}} identifies every component, wires circuits independently, and can explain how the parts connect and talk to each other.',
    'bigger_picture', 'This is systems thinking: knowing that the result depends on how the parts connect, not only on what each part does. It is how people make sense of a business, a supply chain, a sports team or the body. Those who think in systems are the ones who can fix the whole, not just a piece.')),
('strength.coachable', 'strength', 'Coachable', 30,
  '{"all": [{"fact": "coding", "op": "neq", "value": "excellent"}, {"fact": "robotics", "op": "neq", "value": "excellent"}]}',
  jsonb_build_object(
    'title', 'Learns by building and acts on guidance',
    'body', '{{first_name}} understands most of the code, knows the main job of each component, and turns a pointer from the facilitator into a working build.',
    'bigger_picture', 'Coachability is one of the traits employers rate highest, and it is rarer than talent. A learner who can take feedback and turn it into a result straight away improves faster than anyone around them, at school, in sport and later at work.')),
('strength.consistency', 'strength', 'Fully up to date', 40,
  '{"all": [{"fact": "lessons_to_catch_up", "op": "eq", "value": 0}, {"fact": "all_top_level", "op": "eq", "value": false}]}',
  jsonb_build_object(
    'title', 'Fully up to date',
    'body', '{{first_name}} has not fallen behind on a single lesson.',
    'bigger_picture', 'Consistency compounds. Skills like coding are built in small steps that stack on each other, and the people who show up every time end up far ahead of the people who are brilliant once. That habit carries straight into exams, careers and anything worth getting good at.')),

('growth.catch_up', 'growth', 'Catch up missed lessons', 10,
  '{"all": [{"fact": "all_top_level", "op": "eq", "value": true}, {"fact": "lessons_to_catch_up", "op": "gt", "value": 0}]}',
  jsonb_build_object(
    'title', 'Catching up {{lessons_to_catch_up}} missed {{lessons_word}}',
    'now', '{{first_name}}''s skill level is already at the top of our rubric in both coding and robotics.',
    'next', 'The only thing between {{first_name}} and the next level is the {{lessons_to_catch_up}} {{lessons_word}} still to catch up. We''ll share the catch-up tasks so nothing is left out.',
    'home', 'Set aside one short session this week for {{first_name}} to work through the catch-up tasks, and ask {{first_name}} to show you what the finished program does.')),
('growth.original_projects', 'growth', 'Original projects', 20,
  '{"all": [{"fact": "all_top_level", "op": "eq", "value": true}]}',
  jsonb_build_object(
    'title', 'Designing original projects',
    'now', '{{first_name}} is working at the top of our rubric in both coding and robotics and is fully up to date.',
    'next', 'The next challenge is starting from a blank screen: planning, building and testing a project of {{first_name}}''s own design.',
    'home', 'Ask {{first_name}} "if you could build a robot to solve one problem in our house, what would it do?" and let the idea grow from there.')),
('growth.wiring', 'growth', 'Wiring without the diagram', 30,
  '{"all": [{"fact": "coding", "op": "eq", "value": "excellent"}], "area": "robotics.wiring"}',
  jsonb_build_object(
    'title', 'Wiring without the diagram',
    'now', '{{first_name}} wires circuits correctly with some guidance and understands the basic connections.',
    'next', 'The next step is wiring independently and explaining how each component communicates before powering up.',
    'home', 'Ask {{first_name}} to explain how something at home works, like a torch, a doorbell or the TV remote. Which part sends the signal, and which part responds?')),
('growth.debugging', 'growth', 'Fixing errors independently', 90,
  '{"all": [], "area": "coding.debugging"}',
  jsonb_build_object(
    'title', 'Fixing errors independently',
    'now', '{{first_name}} can spot some errors in a program and completes tasks with some guidance.',
    'next', 'The next step is finding and fixing bugs without help, and running code start to finish on their own.',
    'home', 'When something doesn''t work at home, from a game to a gadget, ask {{first_name}} "what do you think is causing it?" before stepping in.')),

('learner_note.catch_up', 'learner_note', 'Top level, lessons to catch up', 10,
  '{"all": [{"fact": "all_top_level", "op": "eq", "value": true}, {"fact": "lessons_to_catch_up", "op": "gt", "value": 0}]}',
  jsonb_build_object('text', '{{first_name}}, you''re building at the highest level we assess. Catch up those {{lessons_to_catch_up}} {{lessons_word}} and the harder missions are yours.')),
('learner_note.top', 'learner_note', 'Top level, up to date', 20,
  '{"all": [{"fact": "all_top_level", "op": "eq", "value": true}]}',
  jsonb_build_object('text', '{{first_name}}, you''re coding and wiring at the highest level we assess. Time to invent something of your own.')),
('learner_note.programmer', 'learner_note', 'Strong coder', 30,
  '{"all": [{"fact": "coding", "op": "eq", "value": "excellent"}]}',
  jsonb_build_object('text', '{{first_name}}, you think like a real programmer. Next up: wiring circuits with no diagram to lean on.')),
('learner_note.default', 'learner_note', 'Default', 90,
  '{"all": []}',
  jsonb_build_object('text', '{{first_name}}, every build you finish makes the next one easier. Next goal: catch your own bugs before anyone else does.')),

('whats_next.advanced', 'whats_next', 'Ready for advanced projects', 10,
  '{"all": [{"fact": "all_top_level", "op": "eq", "value": true}]}',
  jsonb_build_object('text', '{{first_name}} is ready for more advanced, open-ended projects. Reply to your RAD Academy WhatsApp message and we''ll tell you about the next programme first.')),
('whats_next.default', 'whats_next', 'Default', 90,
  '{"all": []}',
  jsonb_build_object('text', '{{first_name}} has a solid base to build on. Reply to your RAD Academy WhatsApp message and we''ll tell you about the next programme first, so the momentum isn''t lost.'));
