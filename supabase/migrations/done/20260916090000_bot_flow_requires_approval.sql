-- A flow this always routes through the /admin/lead-funnel/outbox approval
-- queue before sending, regardless of which lead tapped it - distinct from
-- leads.is_business_number (per-lead) in src/lib/leadSend.ts's sendToLead().
alter table bot_flows
  add column if not exists requires_approval boolean not null default false;
