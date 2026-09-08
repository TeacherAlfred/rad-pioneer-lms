-- A button tap can now just tag the lead, with no reply required. Every
-- action_type before this always sent something (a message, a template, or
-- bot media) - even a "just note this happened" button had to be given a
-- throwaway reply purely so it had somewhere to carry add_tags. tag_only
-- flows skip the send entirely; the inbound "[Button Reply: ...]" log
-- (written unconditionally in the webhook regardless of which flow matches,
-- see STAGE 2 in whatsapp-webhook/route.ts) is what keeps the tap itself
-- visible in Message Activity even with nothing sent back.

-- bot_flows predates tracked migrations, so action_type's CHECK constraint
-- has no known name to DROP CONSTRAINT IF EXISTS against directly - find it
-- by definition instead of guessing Postgres's default naming.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'bot_flows'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%action_type%';
  if con_name is not null then
    execute format('alter table bot_flows drop constraint %I', con_name);
  end if;
end $$;

alter table bot_flows
  add constraint bot_flows_action_type_check
  check (action_type in ('message', 'template', 'bot_media', 'tag_only'));
