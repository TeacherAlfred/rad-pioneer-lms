-- Inbound images/stickers/GIFs/audio/documents/voice notes were arriving
-- with no captured content at all (whatsapp-webhook/route.ts only read
-- message.text.body for type 'text' - everything else was silently
-- dropped, showing as a blank message in Message Activity). media_path
-- stores the whatsapp-inbound-media storage bucket path rather than a
-- baked-in URL, since that bucket is private (this can be a lead's own
-- photo of their child) and signed URLs need to be minted fresh per
-- request rather than stored once and going stale.
alter table messages
  add column if not exists media_path text,
  add column if not exists media_type text,
  add column if not exists media_mime_type text,
  add column if not exists media_caption text,
  add column if not exists media_filename text;
