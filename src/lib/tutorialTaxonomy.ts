// Single source of truth for Tutorial Hub level/category values, shared
// between the admin series form (src/app/admin/tutorials/page.tsx, which
// lets an admin pick any of these) and the public Hub filter
// (src/app/tutorials/page.tsx, which only enables the ones actually live)
// - keeps the two from drifting out of sync, since the public filter
// compares against these exact string values.
export const TUTORIAL_LEVELS: { value: string; label: string; enabled: boolean }[] = [
  { value: "beginner", label: "Beginner", enabled: true },
  { value: "intermediate", label: "Intermediate", enabled: false },
  { value: "advanced", label: "Advanced", enabled: false },
];

export const TUTORIAL_CATEGORIES: { value: string; label: string; enabled: boolean }[] = [
  { value: "MakeCode", label: "MakeCode", enabled: true },
  { value: "Scratch", label: "Scratch", enabled: false },
  { value: "Minecraft Education", label: "Minecraft Education", enabled: false },
];
