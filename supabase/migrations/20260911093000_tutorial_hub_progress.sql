-- Cross-device progress for the Tutorial Hub (spec S5). A visitor can
-- optionally link a phone number to carry progress between devices - no
-- password, no full account. Verification is proof-of-possession via
-- WhatsApp click-to-chat (the phone is already the visitor's second screen,
-- see src/app/api/whatsapp-webhook/route.ts's "LINK <code>" branch) rather
-- than a new SMS/OTP vendor, since neither exists in this codebase today.
--
-- tutorial_visitors is a new table rather than a reuse of `leads`: leads
-- carries CRM pipeline/stage assumptions and feeds admin sales views, and
-- folding in anonymous tutorial browsers would pollute that reporting
-- surface. The token/access-log shape below mirrors guardian_consent_tokens
-- / consent_token_access_log exactly - opaque token, resolved server-side,
-- every attempt logged and IP-rate-limited, zero anon RLS policies.
create table tutorial_visitors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  phone text not null unique,
  phone_verified_at timestamptz,
  pending_link_code text,
  pending_link_code_expires_at timestamptz,

  attribution_utm_source text,
  attribution_utm_medium text,
  attribution_utm_campaign text,
  attribution_referrer text
);

alter table tutorial_visitors enable row level security;

create table tutorial_progress_tokens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  tutorial_visitor_id uuid not null references tutorial_visitors(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table tutorial_progress_tokens enable row level security;

create index tutorial_progress_tokens_visitor_idx on tutorial_progress_tokens (tutorial_visitor_id);

create table tutorial_progress_token_access_log (
  id uuid primary key default gen_random_uuid(),
  accessed_at timestamptz not null default now(),

  token_id uuid references tutorial_progress_tokens(id) on delete set null,
  attempted_token text not null,
  success boolean not null,
  ip_address text,
  user_agent text
);

alter table tutorial_progress_token_access_log enable row level security;

create index tutorial_progress_token_access_log_rate_idx
  on tutorial_progress_token_access_log (ip_address, success, accessed_at);

create table tutorial_progress (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  tutorial_visitor_id uuid not null references tutorial_visitors(id) on delete cascade,
  tutorial_id uuid not null references tutorials(id) on delete cascade,
  current_step_order_index integer not null default 0,
  completed_at timestamptz,

  unique (tutorial_visitor_id, tutorial_id)
);

alter table tutorial_progress enable row level security;

create index tutorial_progress_visitor_idx on tutorial_progress (tutorial_visitor_id);

alter table tutorial_offer_clicks
  add column tutorial_visitor_id uuid references tutorial_visitors(id) on delete set null;
