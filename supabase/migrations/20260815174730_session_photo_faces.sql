-- Face detection for the "tag like Google Photos" workflow - see the
-- session-photos admin page. face-api.js runs client-side (free, no
-- per-image cost - see src/lib/photoClearance.ts's neighbour
-- src/lib/faceMatch.ts) and posts back a bounding box + 128-d descriptor
-- per detected face. kid_id is set once an admin assigns a face to a
-- roster child - that assignment also creates/confirms the matching
-- session_photo_subjects row, which stays the single source of truth
-- for clearance computation. Matching candidate faces against an
-- assigned descriptor is deliberately scoped to THIS session only
-- (queries always filter through session_photos.session_id) and never
-- auto-applied - the admin reviews and confirms every suggested match,
-- per explicit instruction not to have this happen invisibly.
alter table session_photos add column faces_detected_at timestamptz;

create table session_photo_faces (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references session_photos(id) on delete cascade,
  bbox jsonb not null,
  descriptor jsonb not null,
  kid_id uuid references kids(id),
  created_at timestamptz not null default now()
);

alter table session_photo_faces enable row level security;
create index session_photo_faces_photo_id_idx on session_photo_faces(photo_id);
create index session_photo_faces_kid_id_idx on session_photo_faces(kid_id);
