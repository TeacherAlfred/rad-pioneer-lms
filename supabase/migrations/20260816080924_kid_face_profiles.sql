-- Cross-session face recognition. Same-session matching (already built -
-- see session_photo_faces) stays exact-instance, but a kid's *profile*
-- here accumulates across every session they've been confirmed-tagged
-- in, so a brand new photo can proactively suggest a name before any
-- manual tagging happens - never applied automatically, only ever a
-- pre-filled suggestion the admin still has to confirm (see
-- src/lib/faceProfile.ts and the PATCH/POST handlers in
-- src/app/admin/api/session-photos/faces/route.ts).
create table kid_face_profiles (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null unique references kids(id) on delete cascade,
  descriptor jsonb not null,
  sample_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table kid_face_profiles enable row level security;

-- suggested_kid_id/suggested_distance: set once at detection time (POST)
-- from a profile match, purely advisory - rendered as a "maybe this
-- kid?" hint on an otherwise-unassigned face box.
--
-- profile_updated: true once this specific face's descriptor has been
-- folded into kid_id's profile (on confirm). Lets an untag exactly
-- reverse that one sample back out (see removeFromProfile) instead of
-- leaving the profile permanently skewed by a since-corrected mistake.
alter table session_photo_faces add column suggested_kid_id uuid references kids(id);
alter table session_photo_faces add column suggested_distance real;
alter table session_photo_faces add column profile_updated boolean not null default false;
