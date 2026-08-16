-- Session Photography system - see RAD_Session_Photography_Process.md.
-- Builds on the existing 5-tier photo consent already captured in
-- consent_forms.payload.photo (src/lib/consent.ts PHOTO_TIERS) - this
-- migration does NOT touch that table. Clearance is deliberately NOT a
-- stored column here (see src/lib/photoClearance.ts) - it's computed
-- live from each subject's current consent_forms row, so a consent
-- downgrade is reflected everywhere instantly instead of going stale.

-- One row per uploaded image for a session. identifiable=false is how a
-- cropped derivative (no recognisable face) escapes all consent
-- requirements entirely (spec S2.4) while keeping the full-frame
-- original's real clearance intact via derivative_of.
create table session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  r2_key text not null,
  taken_at timestamptz,
  quality smallint,
  content_tags text[] not null default '{}',
  background_checked boolean not null default false,
  identifiable boolean not null default true,
  is_derivative boolean not null default false,
  derivative_of uuid references session_photos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table session_photos enable row level security;
create index session_photos_session_id_idx on session_photos(session_id);

-- Many-to-many: which kids appear in which photo. Per-subject
-- `identifiable` (not just the image-level flag above) because a kid
-- turned away in a group shot may not be identifiable even when
-- others in the same frame are - clearance only cares about subjects
-- where this is true. `selected_for_parent` marks the up-to-3 picks
-- for that child's same-evening gift message.
create table session_photo_subjects (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references session_photos(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  identifiable boolean not null default true,
  selected_for_parent boolean not null default false,
  created_at timestamptz not null default now(),
  unique(photo_id, kid_id)
);

alter table session_photo_subjects enable row level security;
create index session_photo_subjects_photo_id_idx on session_photo_subjects(photo_id);
create index session_photo_subjects_kid_id_idx on session_photo_subjects(kid_id);

-- The usage log (spec S5, rule 2: "every publication is logged" - this
-- is what makes the 7-working-day withdrawal promise keepable, since
-- you can't remove an image from a place you didn't record). Never
-- overwritten, one row per publish event, same pattern as
-- lead_status_history/lead_notes. needs_removal is flipped by the
-- consent-downgrade diff (see detectDowngradedTiers in
-- src/lib/photoConsentDiff.ts, wired into
-- src/app/api/consent/[token]/route.ts) and cleared once an admin has
-- actually pulled the image from that destination and set removed_at.
create table session_photo_usage (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references session_photos(id) on delete cascade,
  destination text not null,
  published_at timestamptz not null default now(),
  published_by text,
  needs_removal boolean not null default false,
  removed_at timestamptz,
  notes text
);

alter table session_photo_usage enable row level security;
create index session_photo_usage_photo_id_idx on session_photo_usage(photo_id);
create index session_photo_usage_needs_removal_idx on session_photo_usage(needs_removal) where needs_removal;

-- Guardian+session scoped magic link for the delivery gallery page
-- (/photos/[token]) - same shape as session_kiosk_tokens, but scoped
-- to one guardian's view of one session rather than the whole roster.
create table photo_gallery_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  guardian_lead_id uuid not null references leads(id),
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table photo_gallery_tokens enable row level security;
create index photo_gallery_tokens_guardian_idx on photo_gallery_tokens(guardian_lead_id);
create index photo_gallery_tokens_session_idx on photo_gallery_tokens(session_id);

create table photo_gallery_token_access_log (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references photo_gallery_tokens(id) on delete set null,
  attempted_token text,
  success boolean not null,
  ip_address text,
  user_agent text,
  accessed_at timestamptz not null default now()
);

alter table photo_gallery_token_access_log enable row level security;
create index photo_gallery_token_access_log_ip_time_idx on photo_gallery_token_access_log(ip_address, accessed_at);
