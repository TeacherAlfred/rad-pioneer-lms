-- Seeds the standard three onboarding items onto every series that
-- doesn't already have any (guarded by NOT EXISTS so this is safe to run
-- against a project with existing series). Going forward the admin
-- create-series route seeds these automatically for new series - this
-- migration only covers series created before that route was updated.
insert into tutorial_series_intro_items (series_id, title, instruction, order_index)
select s.id, item.title, item.instruction, item.order_index
from tutorial_series s
cross join (values
  (0, 'Accessing the Resources', E'This tutorial uses the **MakeCode** editor. Open it in a new tab on the device you''re coding on, and keep this guide open alongside it.\n\n- [MakeCode for micro:bit](https://makecode.microbit.org)\n- [Minecraft Education](https://education.minecraft.net)\n- [Scratch](https://scratch.mit.edu)'),
  (1, 'The Platform UI', 'A quick tour of what you''ll see when you open the editor. Tap the highlighted dots on the screenshot below for a quick explanation of each part.'),
  (2, 'Finding Tutorials on the Platform', 'Some tutorials also live inside the editor itself. Tap the highlighted dots below to see where to find them.')
) as item(order_index, title, instruction)
where not exists (
  select 1 from tutorial_series_intro_items existing where existing.series_id = s.id
);
