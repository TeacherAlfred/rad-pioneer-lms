// Default "before the tutorials" onboarding items seeded onto every new
// series (used by the admin series-create route). Kept in sync by hand
// with the one-time backfill in migration
// 20260915090500_tutorial_series_intro_items_backfill.sql, which covers
// series created before this seeding existed - editing this array doesn't
// retroactively change already-seeded rows, only what new series get.
export const DEFAULT_SERIES_INTRO_ITEMS = [
  {
    title: 'Accessing the Resources',
    instruction: "This tutorial uses the **MakeCode** editor. Open it in a new tab on the device you're coding on, and keep this guide open alongside it.\n\n- [MakeCode for micro:bit](https://makecode.microbit.org)\n- [Minecraft Education](https://education.minecraft.net)\n- [Scratch](https://scratch.mit.edu)",
  },
  {
    title: 'The Platform UI',
    instruction: "A quick tour of what you'll see when you open the editor. Tap the highlighted dots on the screenshot below for a quick explanation of each part.",
  },
  {
    title: 'Finding Tutorials on the Platform',
    instruction: 'Some tutorials also live inside the editor itself. Tap the highlighted dots below to see where to find them.',
  },
];
