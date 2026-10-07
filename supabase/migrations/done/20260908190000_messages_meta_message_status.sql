-- Captures Meta's own `message_status` from the synchronous send response
-- (accepted / held_for_quality_assessment / paused - see Meta's Cloud API
-- Messages reference). `accepted` does NOT mean delivered - a message can
-- still be held for quality review or paused after the API call returns
-- 200 OK. Every "[Delivered ...]" bracket-body write happens the moment
-- Meta's HTTP response succeeds, before this distinction is known, so
-- without this column a held/paused send was indistinguishable from a
-- normal one anywhere in the UI.
alter table messages
  add column if not exists meta_message_status text;
