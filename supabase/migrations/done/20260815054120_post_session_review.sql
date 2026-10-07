-- Post-Session Review - see RAD_Post_Session_Review_Spec.md. Two forms:
-- the child's (kiosk, in-room, no login) and the educator's (one per
-- session), plus the testimonial queue they feed. Kids have no accounts
-- in this pipeline (see kids table) so the kiosk is a session-scoped
-- token, same shape as the consent form's guardian token but scoped to
-- a Session's roster instead of a Guardian's children.

-- One row per child per session. Upserted incrementally as the child
-- answers each question (spec: "Partial submissions save. An incomplete
-- honest answer beats an abandoned one.") - hold_status is recomputed
-- server-side on every save from whatever fields are known so far.
create table session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references kids(id) on delete cascade,
  enjoyment integer,
  built_text text,
  difficulty text,
  completion text,
  wants_more text,
  open_text text,
  device_context text,
  hold_status text not null default 'none',
  released_at timestamptz,
  released_by text,
  completed_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table session_reviews enable row level security;
create index session_reviews_session_id_idx on session_reviews(session_id);

-- One row per session, completed by whoever delivered it. No educator
-- identity table exists yet (open question in the spec), so this is a
-- free-text name for now rather than a foreign key.
create table session_reviews_educator (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  educator_name text,
  attendance_actual integer,
  timing text,
  failures_text text,
  struggled_student_ids uuid[],
  excelled_student_ids uuid[],
  curriculum_notes text,
  media_captured boolean not null default false,
  media_count integer,
  submitted_at timestamptz not null default now()
);

alter table session_reviews_educator enable row level security;

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  source_review_id uuid references session_reviews(id) on delete set null,
  session_id uuid references sessions(id),
  quote_text text not null,
  display_age integer,
  display_programme text,
  display_month text,
  consent_verified boolean not null default false,
  status text not null default 'pending',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;
create index testimonials_status_idx on testimonials(status);

-- Kiosk token: scoped to one Session, exposes that session's roster
-- (first/preferred names) - "restricted, not a public URL" per the spec.
-- expires_at is set at creation (see admin route) rather than left open,
-- since the spec requires it to expire when the session closes.
create table session_kiosk_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table session_kiosk_tokens enable row level security;
create index session_kiosk_tokens_session_id_idx on session_kiosk_tokens(session_id);

create table kiosk_token_access_log (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references session_kiosk_tokens(id) on delete set null,
  attempted_token text,
  success boolean not null,
  ip_address text,
  user_agent text,
  accessed_at timestamptz not null default now()
);

alter table kiosk_token_access_log enable row level security;
create index kiosk_token_access_log_ip_time_idx on kiosk_token_access_log(ip_address, accessed_at);
