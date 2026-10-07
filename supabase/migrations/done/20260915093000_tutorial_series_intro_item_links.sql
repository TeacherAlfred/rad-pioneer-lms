-- Each series onboarding item ("Getting Started" card) gets its own
-- "Open Guide" link - e.g. straight to the MakeCode website for
-- "Accessing the Resources", or to a specific help page for "The Platform
-- UI" - shown as a button in the item's popup, opening in a new tab.
-- Distinct from tutorials.link_url (the shared editor link for every step
-- in a tutorial): this is per onboarding-item, since each one points
-- somewhere different.
alter table tutorial_series_intro_items add column link_url text;
alter table tutorial_series_intro_items add column link_label text;
