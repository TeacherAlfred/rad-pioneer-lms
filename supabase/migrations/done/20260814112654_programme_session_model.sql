-- Restructures the kids/programs MVP (2026-08-14) into the Programme
-- Model & Catalogue: Guardian (existing leads, unchanged) -> Student ->
-- Enrolment -> Session -> Programme, plus Pass/PassCredit/Order/Bundle
-- for the commerce layer. Table names kept as `kids`/`programs` (not
-- renamed to `students`/`programmes`) - the older profiles pipeline
-- already owns a `students` table (first_name/last_name/linked_parent_id),
-- same kind of collision as `courses`/`enrollments` hit yesterday. DB
-- table stays `kids`; app layer (routes, types, UI copy) uses "Student"
-- per the business doc, same pattern as `programs` standing in for
-- "Programme".
--
-- Core rule this enforces: a Programme is curriculum (never dated, never
-- priced); a Session is one dated/priced/staffed delivery of a Programme.
-- Repeating an offering means a new Session, not a new Programme.

-- 1. Add date_of_birth as the field programme eligibility should compute
-- from going forward. `age` is kept as a fallback only - the WhatsApp
-- bot captures an informal age, not a birthdate, so requiring
-- date_of_birth would block real data entry.
alter table kids add column date_of_birth date;
comment on column kids.age is 'Fallback only - prefer date_of_birth once known. Ages go stale; kept because WhatsApp-captured data is informal.';
comment on column kids.date_of_birth is 'Preferred over age - programme eligibility (age_min/age_max) should compute against this once known.';

-- 2. programs and program_enrollments were shipped empty yesterday and
-- conflated Programme+Session (start_date/end_date/location sat directly
-- on the programme). Nothing depends on that shape yet - safe to drop
-- and rebuild properly rather than ALTER in place.
drop table program_enrollments;
drop table programs;

-- Programme: curriculum only. Never a date, a price, or a room.
create table programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  type text not null,
  audience text not null default 'student',
  level text,
  sequence integer,
  version integer not null default 1,
  age_min integer,
  age_max integer,
  duration_hours numeric(4,1),
  prerequisite_programme_id uuid references programs(id),
  description_short text,
  description_long text,
  includes text[],
  active boolean not null default true
);

alter table programs enable row level security;
create index programs_prerequisite_idx on programs(prerequisite_programme_id);

-- Session: one dated, priced, staffed delivery of a Programme. Also
-- covers term-course weekly lessons via parent_session_id (the term
-- itself is the parent row; each lesson is a child row with its own
-- starts_at/ends_at) - same attendance mechanics as a single workshop,
-- per the model doc.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  programme_id uuid not null references programs(id) on delete cascade,
  parent_session_id uuid references sessions(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  sales_open_at timestamptz,
  sales_close_at timestamptz,
  early_bird_ends_at timestamptz,
  venue text,
  capacity integer,
  min_viable_enrolments integer,
  go_no_go_at timestamptz,
  status text not null default 'draft',
  price numeric(10,2),
  currency text not null default 'ZAR',
  notes text
);

alter table sessions enable row level security;
create index sessions_programme_id_idx on sessions(programme_id);
create index sessions_parent_session_id_idx on sessions(parent_session_id);

-- Enrolment: Student registered on a Session (not a Programme directly).
-- order_id / pass_credit_id let an enrolment trace back to how it was
-- paid for - direct order, or a redeemed pass credit. Both nullable and
-- added via ALTER after orders/pass_credits exist below (circular refs).
create table enrolments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references kids(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  status text not null default 'registered',
  order_id uuid,
  pass_credit_id uuid,
  notes text
);

alter table enrolments enable row level security;
create index enrolments_student_id_idx on enrolments(student_id);
create index enrolments_session_id_idx on enrolments(session_id);

-- Bundle: sessions sold together at a fixed price, fixed at purchase -
-- distinct from a Pass, and can cross programmes (e.g. Polokwane's
-- two-day: one MCE-101 session + one ROB-101 session, one price).
create table bundles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  active boolean not null default true
);

alter table bundles enable row level security;

create table bundle_sessions (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  unique (bundle_id, session_id)
);

alter table bundle_sessions enable row level security;
create index bundle_sessions_bundle_id_idx on bundle_sessions(bundle_id);
create index bundle_sessions_session_id_idx on bundle_sessions(session_id);

-- Order: a purchase by a Guardian (leads row). What was bought - a pass,
-- a bundle, or a single direct session - is inferred from what
-- references the order (a Pass row, bundle_id here, or an Enrolment's
-- order_id), not a separate "kind" field.
create table orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  guardian_lead_id uuid not null references leads(id),
  bundle_id uuid references bundles(id),
  amount_total numeric(10,2),
  currency text not null default 'ZAR',
  status text not null default 'pending',
  payment_reference text,
  notes text
);

alter table orders enable row level security;
create index orders_guardian_lead_id_idx on orders(guardian_lead_id);

-- Pass: a purchased entitlement to N sessions, redeemed over time.
-- first_session_id is NOT NULL deliberately - the model doc calls this
-- "required at purchase, non-negotiable" (it forces the attendance that
-- generates proof for the acquisition funnel), so it's enforced here
-- rather than left as a policy someone has to remember.
create table passes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  guardian_lead_id uuid not null references leads(id),
  order_id uuid references orders(id),
  credits_total integer not null default 3,
  credits_used integer not null default 0,
  qualifying_location text,
  qualifying_types text[],
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_session_id uuid not null references sessions(id),
  unused_credit_value numeric(10,2) not null default 500,
  constraint passes_credits_used_within_total check (credits_used <= credits_total)
);

alter table passes enable row level security;
create index passes_guardian_lead_id_idx on passes(guardian_lead_id);

-- PassCredit: one row per credit on a pass, tracking redemption into a
-- specific Enrolment. credits_used on the pass above is a cached count -
-- this table is the source of truth for which credits are spent.
create table pass_credits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pass_id uuid not null references passes(id) on delete cascade,
  status text not null default 'unredeemed',
  enrolment_id uuid,
  redeemed_at timestamptz
);

alter table pass_credits enable row level security;
create index pass_credits_pass_id_idx on pass_credits(pass_id);

-- Close the circular references between enrolments <-> orders/pass_credits.
alter table enrolments add constraint enrolments_order_id_fkey foreign key (order_id) references orders(id);
alter table enrolments add constraint enrolments_pass_credit_id_fkey foreign key (pass_credit_id) references pass_credits(id);
alter table pass_credits add constraint pass_credits_enrolment_id_fkey foreign key (enrolment_id) references enrolments(id);

-- 3. Inject the catalogue from RAD_Programme_Model_and_Catalogue.md
-- section 3. Programmes only, deliberately no dates/prices - those are
-- Session concerns and get entered once real delivery dates exist.
-- description_long is trimmed of pricing sentences from the source doc
-- (e.g. "R2,000 per term...") since price belongs on Session, not here.
insert into programs (code, name, type, audience, level, sequence, age_min, age_max, duration_hours, description_short, description_long, includes) values
(
  'MCE-101', 'Minecraft Education: From Player to Developer', 'workshop', 'student', 'Foundation', 1, 8, 14, 3,
  'Your child already knows Minecraft. Here they learn to rewrite it.',
  'Most children spend hundreds of hours playing by rules someone else wrote. In this workshop they cross to the other side - using Block coding and Python syntax inside Minecraft Education to change the physics of the game world itself. The moment a child types their first line of syntax to bend the rules, they stop being a player and become a developer.',
  array['One-month Minecraft Education licence', 'Moderated environment (no public lobbies)', 'CAPS-alignment toolkit']
),
(
  'ROB-101', 'Robotics for a Sporty World', 'workshop', 'student', 'Foundation', 1, 8, 14, 3,
  'The circuits they''ve been building in a game, made real.',
  'Redstone in Minecraft is Boolean logic and binary states wearing a disguise. This session hands your child the real components - a micro:bit, an accelerometer, sensors - and has them build something that measures the physical world. Step counters, reaction timers, movement sensors. They design it, code it, and debug it when it doesn''t work first time, which is exactly what a professional engineer''s day looks like. They leave with the build plan and photographs to recreate it at home. Take-home kits available to purchase on the day.',
  array['Build plan to recreate at home', 'Photographs of their build']
),
(
  'ROB-201', 'Advanced Robotics & App Control', 'workshop', 'student', 'Intermediate', 2, 10, 16, 3,
  'From a device that senses to a device you control.',
  'For children who have already built their first circuit. This session adds motors, multiple sensors working together, and control from a phone - the point at which a project stops being a school exercise and starts resembling a product.',
  null
),
(
  'OTL-101', 'RAD Online: Foundations', 'term_course', 'student', 'Foundation', 1, 8, 12, null,
  'A term of weekly live lessons that build on each other, and on last term.',
  'Where workshops create the spark, term lessons build the skill. Small live cohorts aligned to the South African school calendar, with each term picking up where the last one left off - so a child who starts in Grade 5 arrives in high school with three years of compounding technical work behind them, not three unconnected holiday activities.',
  null
),
(
  'OTL-201', 'RAD Online: Builders', 'term_course', 'student', 'Intermediate', 2, 10, 14, null,
  'A term of weekly live lessons that build on each other, and on last term.',
  'Where workshops create the spark, term lessons build the skill. Small live cohorts aligned to the South African school calendar, with each term picking up where the last one left off - so a child who starts in Grade 5 arrives in high school with three years of compounding technical work behind them, not three unconnected holiday activities.',
  null
),
(
  'OTL-301', 'RAD Online: Creators', 'term_course', 'student', 'Advanced', 3, 12, 16, null,
  'A term of weekly live lessons that build on each other, and on last term.',
  'Where workshops create the spark, term lessons build the skill. Small live cohorts aligned to the South African school calendar, with each term picking up where the last one left off - so a child who starts in Grade 5 arrives in high school with three years of compounding technical work behind them, not three unconnected holiday activities.',
  null
),
(
  'WEB-101', 'Hacking Screen Time: The Parent Session', 'webinar', 'guardian', null, null, null, null, 0.75,
  'You aren''t failing. The system is rigged. Here''s what works instead.',
  'Forty-five minutes, live, with a build you watch happen. Fifteen minutes on why time limits lose to companies employing behavioural psychologists, twenty minutes building a load-shedding smart light on a micro:bit while we narrate it the way a ten-year-old experiences it, and ten minutes of your questions. You leave able to have a different conversation with your child tonight.',
  null
),
(
  'WEB-201', 'Robotics for Parents: What They''re Actually Learning', 'webinar', 'guardian', null, null, null, null, 0.75,
  null, null, null
),
(
  'GAM-101', 'Minecraft Education Online Gamathon', 'competition', 'student', null, null, null, null, null,
  null, null, null
),
(
  'HOL-101', 'RAD Holiday Programme', 'holiday_programme', 'student', null, null, null, null, null,
  null, null, null
),
(
  'YE-101', 'RAD Year-End Showcase', 'year_end', 'family', null, null, null, null, null,
  null, null, null
),
(
  'TT-101', 'Educator Training: Minecraft Education in the Classroom', 'b2b_training', 'teacher', null, null, null, null, null,
  null, null, null
),
(
  'SW-101', 'Digital Skills Demonstration', 'b2b_school', 'student', null, null, null, null, null,
  null, null, null
),
(
  'PVT-101', 'Private Tuition', 'private', 'student', null, null, null, null, null,
  null, null, null
);

-- ROB-201's prerequisite is ROB-101 ("Prerequisite: ROB-101 or
-- demonstrable equivalent experience") - set after both rows exist.
update programs set prerequisite_programme_id = (select id from programs where code = 'ROB-101')
where code = 'ROB-201';
