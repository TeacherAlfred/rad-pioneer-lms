-- Lets an admin hide the whole "Getting Started" carousel on a series page
-- until its content (screenshots, guide hotspots) is actually ready,
-- rather than it going live the moment a series is published just because
-- the 3 default items were auto-seeded. Defaults to hidden - an admin
-- explicitly flips this on from the series editor once it's worth showing.
alter table tutorial_series add column intro_items_visible boolean not null default false;
