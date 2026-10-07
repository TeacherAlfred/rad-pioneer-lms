-- Audit trail for opting out/back in - mirrors leads.blocked_at's pattern
-- (20260907240000_lead_blocking.sql). Needed because there was previously
-- no way to reverse leads.opted_out at all: the webhook's "stop" keyword
-- handler sets it true directly, and PATCH /admin/api/lead-funnel only ever
-- set it true too (as a side effect of moving lifecycle_stage to
-- 'opted_out'), never false - an accidental "stop" or a changed mind had no
-- undo. See PATCH's new standalone opted_out handling.
alter table leads
  add column if not exists opted_out_at timestamptz;
