-- Track when an irene_responses record was verified, so the admin UI can show a timestamp
-- alongside the existing is_verified boolean.
alter table irene_responses
  add column verified_at timestamptz;

-- Backfill: any record already verified gets a best-effort timestamp (now), rather than
-- silently sitting on a null forever.
update irene_responses
  set verified_at = now()
  where is_verified = true and verified_at is null;
