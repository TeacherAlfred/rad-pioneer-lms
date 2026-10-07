-- Which bot_flows row produced a queued entry (if any - the welcome menu,
-- opt-out prompt, etc. queue too but aren't sourced from a bot_flows row),
-- and why it was queued. Both leads.is_business_number and a flow's own
-- requires_approval can independently be true for the same send, so reason
-- is an array rather than a single enum column.
alter table outbound_message_queue
  add column if not exists bot_flow_id uuid references bot_flows(id) on delete set null,
  add column if not exists reason text[] not null default '{}';
