-- 20260817120000's one-time engagement_recency backfill treated a null
-- last_inbound_at as unconditionally 'cold' (120+ days), instead of falling
-- back to created_at the way the nightly cron's JS logic
-- (computeEngagementRecency in src/app/api/lead-funnel/cron/route.ts) does.
-- Result: leads created via warm-list import or Irene consent - who've
-- never sent an inbound WhatsApp message, so last_inbound_at is genuinely
-- null - got marked "cold" the moment they were created, even ones only a
-- few days old. Recomputes with the same coalesce-to-created_at fallback
-- the cron uses, so this stays consistent once the cron actually runs.
update leads set engagement_recency = case
  when coalesce(last_inbound_at, created_at) >= now() - interval '14 days' then 'active'
  when coalesce(last_inbound_at, created_at) >= now() - interval '45 days' then 'cooling'
  when coalesce(last_inbound_at, created_at) >= now() - interval '120 days' then 'dormant'
  else 'cold'
end;

update leads set stage_health = case
  when lifecycle_stage in ('won', 'lost', 'opted_out') then 'active'
  when now() - stage_entered_at <= case lifecycle_stage
    when 'new' then interval '3 days'
    when 'engaged' then interval '14 days'
    when 'qualified' then interval '3 days'
    when 'offered' then interval '48 hours'
    when 're_nurture' then interval '90 days'
    else interval '999 days'
  end then 'active'
  when engagement_recency in ('dormant', 'cold') then 'dormant'
  else 'stalled'
end;
