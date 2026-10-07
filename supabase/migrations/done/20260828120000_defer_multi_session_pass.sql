-- Deferred (2026-08-24 conversation): a multi-workshop pass (buy once,
-- redeem 3x within 6 months, only the first session dated at purchase - the
-- other two chosen later against sessions that may not exist yet) is a
-- credit/redemption product, not a fixed-composition package. It needs the
-- existing passes/pass_credits system (20260814112654_programme_session_
-- model.sql) wired into this pricing engine, which isn't scoped yet.
-- "Pretoria Multi-Workshop Pass" was drafted in the library and marked
-- inactive (never attached/published, so it was never actually reachable by
-- a lead) pending that work.
insert into system_checklist_items (system_key, label, state, notes, sort_order)
select 'pricing_engine', 'Multi-session pass / credit redemption (buy once, redeem N times)', 'not_started',
  'Needs the existing passes/pass_credits tables wired into event_packages/quotes - not just a package with a final_fee. "Pretoria Multi-Workshop Pass" drafted in the library, marked inactive pending this.', 9
where not exists (
  select 1 from system_checklist_items
  where system_key = 'pricing_engine' and label = 'Multi-session pass / credit redemption (buy once, redeem N times)'
);
