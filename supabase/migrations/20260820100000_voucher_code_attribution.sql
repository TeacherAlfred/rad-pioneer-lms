-- Flyer/voucher channels (75HARD, running clubs, Irene fitness flyer) arrive
-- as a wa.me link with a prefilled message carrying a code, e.g. "Hi, I'd
-- like the guide - code: RUN2" - not a button tap, so there's no bot_flows
-- row to attach this to. Detection is a text substring match against a
-- maintained list at webhook time (see whatsapp-webhook/route.ts).
--
-- Dedicated column rather than overloading `tags` - tags already does media
-- tag-filter matching (bot_media.tag_filter), and mixing the two jobs would
-- make both harder to query (RAD_Academy_Dev_Spec_Warm-List_Menu_Voucher_
-- Attribution.md §2).
alter table leads add column voucher_code text;
create index leads_voucher_code_idx on leads(voucher_code) where voucher_code is not null;

-- Lookup table, not hardcoded conditionals - this list is expected to grow
-- (more flyer channels, more running clubs) and a code needs to be addable
-- without a code deploy. No admin UI yet (track 2/next pass) - add/edit rows
-- directly for now.
create table voucher_codes (
  code text primary key,
  source_value text not null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table voucher_codes enable row level security;

-- source_value shared as a broad 'flyer_voucher' across all five, with the
-- specific code carried in leads.voucher_code - keeps the weekly stage-report
-- query simple (group by source for the channel-type rollup, filter by
-- voucher_code for the per-flyer breakdown) without needing five distinct
-- source strings that all mean the same "physical/personal flyer" thing.
insert into voucher_codes (code, source_value, note) values
  ('75HARD', 'flyer_voucher', 'Fitness group, post-75-day-challenge - Pretoria, 5 spots left. No hold/reward logic - routes straight to needs_human (see route.ts).'),
  ('PLK-CATS', 'flyer_voucher', 'Polokwane running club 1 - TODO confirm real club name/identifier. Gets an extended 96-120h hold once the hold-duration lookup exists (spec §3.2, not yet built).'),
  ('RUN2', 'flyer_voucher', 'Running club 2 - TODO replace with actual club name/identifier.'),
  ('RUN3', 'flyer_voucher', 'Running club 3 - TODO replace with actual club name/identifier.'),
  ('FIT-IPS', 'flyer_voucher', 'Irene Primary flyer - deliberately distinct from the irene_ips voting-campaign source tag. Do not conflate the two in reporting.');
