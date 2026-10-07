-- Reporting-only companion to expects_reply/reply_label (see
-- 20260817140000_bot_flow_reply_capture.sql): once a lead's reply is
-- captured, optionally stamp leads.tags so admins can filter/see who
-- actually completed a specific flow (e.g. "webinar_registered") in
-- /admin/lead-funnel. Purely a label - doesn't change needs_human or any
-- other bot behavior.
alter table bot_flows add column completion_tag text;

-- Denormalized onto the lead at the moment the flow fires, same reasoning
-- as awaiting_reply_label/confirmation - immune to the flow being edited
-- afterward, no join needed at capture time.
alter table leads add column awaiting_reply_completion_tag text;

update bot_flows set completion_tag = 'webinar_registered' where trigger_button_id = 'btn_register_webinar';
update bot_flows set completion_tag = 'call_requested' where trigger_button_id = 'btn_call';
