-- Adds 'leads_contacted' as a valid dashboard_focus_items.metric_key -
-- an auto-computed habit metric (evaluateFocusItem in
-- src/lib/dashboard-v2/focusItemEvaluators.ts counts lead_call_queue rows
-- marked done, the same "processed" definition the Call Queue dashboard
-- cards use) so outbound-contact volume doesn't need a manual tap per call
-- when the system already has the real count.
alter table dashboard_focus_items drop constraint dashboard_focus_items_metric_key_check;
alter table dashboard_focus_items add constraint dashboard_focus_items_metric_key_check
  check (metric_key in ('focus_log', 'qualification_checks', 'leads_contacted'));
