-- Separate image for a program's card on the /events listing, distinct from
-- image_url (which the /events/[id] detail page shows uncropped, at full
-- detail). The listing card crops to fill its column and zooms on hover, so
-- it suits a simpler, crop-tolerant graphic - e.g. an alt flyer cut - while
-- the detail page keeps the detailed one.
--
-- Optional: null means the listing card falls back to image_url, so every
-- existing row behaves exactly as before.
alter table featured_programs
  add column listing_image_url text;
