-- Template Rollout Wizard: a single place that owns what went into a WhatsApp
-- message template from the moment it's drafted through Meta approval and
-- into either ad-hoc-ready (Lane A) or bot-flow-linked (Lane B) - see the
-- Template Rollout Runbook. Meta only ever stores name/language/category/
-- components/status; everything else an admin typed to get there (friendly
-- placeholder labels, sample values, which lane, which bot_flows row) has no
-- home anywhere else, and Meta's own dashboard has no notion of "lane" at
-- all - hence a table of our own rather than just polling Meta harder.

create table template_rollouts (
  id uuid primary key default gen_random_uuid(),

  -- Step 1: Basics
  name text not null,
  category text not null check (category in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  language text not null default 'en_US',

  -- Step 2: Body & placeholders. Submitted to Meta as plain numbered
  -- {{1}}, {{2}}... placeholders (the reliably-supported form) - labels/
  -- samples below are ours alone, never sent to Meta as parameter names.
  body_text text not null default '',
  header_text text,
  footer_text text,
  placeholder_labels text[] not null default '{}',
  placeholder_samples text[] not null default '{}',

  -- Step 3: Buttons. [{type: 'QUICK_REPLY'|'URL'|'PHONE_NUMBER', text, url?, phone_number?}]
  buttons jsonb not null default '[]',

  -- Submission / approval
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  meta_template_id text,
  meta_status text,
  meta_rejected_reason text,
  submitted_at timestamptz,
  last_checked_at timestamptz,

  -- Lane
  lane text check (lane in ('a', 'b')),
  linked_bot_flow_id uuid references bot_flows(id) on delete set null,
  lane_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (name, language)
);

alter table template_rollouts enable row level security;
