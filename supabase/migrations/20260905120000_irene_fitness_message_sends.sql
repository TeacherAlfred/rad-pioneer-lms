-- A log (not a single flag) of every "Send" click on the Responses admin
-- page's Guide/My Link buttons, per family/message/channel - lets the admin
-- see "Sent 2 days ago" and avoid an accidental duplicate, without blocking
-- a genuine deliberate follow-up. Records the click, not delivery - same
-- honesty level as the existing copy-to-clipboard convention these buttons
-- already use (there's no way to know if a WhatsApp/email actually landed).
create table irene_fitness_message_sends (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references irene_fitness_families(id) on delete cascade,
  template_key text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  sent_at timestamptz not null default now()
);

create index irene_fitness_message_sends_lookup_idx
  on irene_fitness_message_sends (family_id, template_key, channel, sent_at desc);
