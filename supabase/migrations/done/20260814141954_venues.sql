-- Saved venues for Sessions - either 'online' or 'physical' (with GPS
-- coordinates so an address can be pinned rather than retyped/mistyped
-- per session). Sessions get a venue_id FK; the existing free-text
-- `venue` column stays as a fallback for one-off locations not worth
-- saving (e.g. a school-arranged workshop at a location visited once).

create table venues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  type text not null default 'physical',
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  maps_url text,
  notes text,
  active boolean not null default true
);

alter table venues enable row level security;

alter table sessions add column venue_id uuid references venues(id);
comment on column sessions.venue is 'Fallback free-text venue label, used when no saved venue in `venues` fits - prefer venue_id.';

insert into venues (name, type) values ('Online', 'online');

insert into venues (name, type, latitude, longitude, maps_url) values (
  'Menlyn Square Office Park', 'physical', -25.786327, 28.277583, 'https://maps.app.goo.gl/WnYSKkD4BJwhViN19'
);
