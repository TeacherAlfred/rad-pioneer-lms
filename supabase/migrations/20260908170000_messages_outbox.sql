-- Messages Outbox: a consolidated record of every outbound send attempt,
-- whether sent via the WhatsApp Business API (method='waba', the existing
-- flow - this column just labels what's already been happening) or via a
-- manual "open WhatsApp Desktop/Web with this text prefilled" click
-- (method='desktop', new - the admin composes the message here, the system
-- logs the attempt, then hands off to wa.me since there's no API delivery
-- confirmation possible for a manually-sent message).
--
-- recipient_phone exists because not every outbound row's actual
-- destination is the linked lead's own number - an admin pipeline alert
-- (see notifyAdmin/notifyAdminOfRegistration/flushBufferedNotifications) is
-- ABOUT a lead but SENT TO the admin's own phone. Existing rows (all
-- lead-directed) leave this null; readers fall back to the lead's phone
-- when it's unset.
--
-- error_code/error_detail capture Meta's actual rejection reason - today
-- that detail only survives as unstructured text baked into a bracketed
-- `[FAILED to deliver ...]` body string. Meta's 24h/72h customer-service-
-- window rejections (e.g. error code 131047) are exactly the kind of thing
-- worth being able to see and query directly, not just guess at from a
-- flattened error string.
alter table messages
  add column if not exists method text not null default 'waba' check (method in ('waba', 'desktop')),
  add column if not exists recipient_phone text,
  add column if not exists error_code text,
  add column if not exists error_detail text;

create index if not exists messages_method_idx on messages(method);
