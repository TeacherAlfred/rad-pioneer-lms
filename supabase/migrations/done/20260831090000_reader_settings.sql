-- Singleton settings row for the reader (Meridian/v1 share it) - a real
-- store for things that were previously hardcoded constants in the source,
-- starting with the vault PIN. The boolean primary key + check constraint is
-- the standard Postgres trick to enforce exactly one row ever existing.
create table rad_reader_settings (
  id boolean primary key default true check (id),
  vault_pin text not null default '112358',
  updated_at timestamptz not null default now()
);

insert into rad_reader_settings (id) values (true);

alter table rad_reader_settings enable row level security;

-- Single-admin app already gated at the app layer by the (private) layout's
-- auth check - same permissive-RLS pattern used elsewhere in this project
-- for low-stakes, single-owner data.
create policy "rad_reader_settings_select"
  on rad_reader_settings for select
  using (true);

create policy "rad_reader_settings_update"
  on rad_reader_settings for update
  using (true) with check (true);
