-- Marks when the 24h-later no-reply follow-up (for the "skill your watch
-- doesn't teach" ad, ad_id 120248999130920372 - see src/lib/adFollowups.ts)
-- was sent to a lead, so the poll that checks for it doesn't send it twice.
-- Deliberately generic-named rather than ad-specific, so a future ad using
-- the same delayed-followup pattern can reuse this column - the ad_id
-- filter that scopes it lives in the query, not the schema.
alter table leads add column ad_followup_sent_at timestamptz;
