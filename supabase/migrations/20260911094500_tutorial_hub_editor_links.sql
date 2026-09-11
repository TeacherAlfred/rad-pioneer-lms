-- Adds a same-device "open in a new tab" affordance to the Tutorial Hub.
-- The second-screen companion pattern (spec S2) is the primary design
-- target, but not every visitor has two screens - someone coding on the
-- same device they're reading this on needs a way to jump to the editor
-- without losing their place.
--
-- One link per tutorial, not per step: it's the same MakeCode project/
-- editor for every step, so tutorials.link_url is what every step's page
-- renders as its persistent "Open Editor" button. tutorial_steps.link_url
-- is a separate, narrower thing - an optional supplementary resource (a
-- video or image explainer) that genuinely varies step to step, unlike the
-- editor link.
alter table tutorials add column link_url text;
alter table tutorials add column link_label text;

alter table tutorial_steps add column link_url text;
alter table tutorial_steps add column link_label text;
