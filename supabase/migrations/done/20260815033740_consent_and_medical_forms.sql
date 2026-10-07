-- Participant Consent & Medical form - see RAD_Consent_and_Medical_Form_Spec.md.
-- Deliberately its own tables, not columns on `kids`/`leads`: this is
-- POPIA special personal information (health data + children's data at
-- once) and must not be reachable from general lead/kid queries. RLS
-- enabled with zero anon policies on all three tables - service role
-- only, same lockdown as `leads` since 2026-08-12. Access happens
-- exclusively through /api/consent/[token], never a direct browser
-- Supabase client (unlike the older /booking/[link_id] page).

-- One row per SUBMISSION, never overwritten - the spec requires being
-- able to answer "on date X, what had this parent agreed to". payload
-- is the full form snapshot (guardian + child + medical + emergency +
-- collection + photo permissions) as it stood at that submission, so a
-- later change to the live leads/kids rows never rewrites history.
create table consent_forms (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references kids(id) on delete cascade,
  guardian_id uuid not null references leads(id),
  submitted_at timestamptz not null default now(),
  submitted_via text not null default 'magic_link',
  ip_address text,
  consent_wording_version text not null default 'v1.0',
  confirmed_unchanged boolean not null default false,
  is_current boolean not null default true,
  payload jsonb not null
);

alter table consent_forms enable row level security;
create index consent_forms_child_id_idx on consent_forms(child_id);
create index consent_forms_child_current_idx on consent_forms(child_id) where is_current;
create index consent_forms_guardian_id_idx on consent_forms(guardian_id);

-- Magic link token per guardian - resolves to that guardian and every
-- child linked to them via kid_guardians. Long-lived by default (no
-- expiry) but revocable; rotate (revoke + reissue) on any change to the
-- guardian's phone number per the spec.
create table guardian_consent_tokens (
  id uuid primary key default gen_random_uuid(),
  guardian_lead_id uuid not null references leads(id),
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table guardian_consent_tokens enable row level security;
create index guardian_consent_tokens_guardian_id_idx on guardian_consent_tokens(guardian_lead_id);

-- Every resolution attempt (valid or not) - the spec calls token leakage
-- a data breach path since it exposes a child's medical information, so
-- this is both the audit trail and the source data for rate-limiting by
-- IP (see resolveToken() in the API route).
create table consent_token_access_log (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references guardian_consent_tokens(id) on delete set null,
  attempted_token text,
  success boolean not null,
  ip_address text,
  user_agent text,
  accessed_at timestamptz not null default now()
);

alter table consent_token_access_log enable row level security;
create index consent_token_access_log_ip_time_idx on consent_token_access_log(ip_address, accessed_at);
