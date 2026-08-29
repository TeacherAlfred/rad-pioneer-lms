// Shared constants for the Robotics Day live workshop platform
// (RAD_Workshop_Platform_MVP_Spec_v1.md). "RAD brand, turned way up":
// each color below is the same hue family as the official --rad-* tokens
// in globals.css, just pushed to full saturation/brightness for a kids'
// dopamine-UX kiosk instead of the muted brand tone used site-wide.

export type Team = "A" | "B";

export type Participant = {
  id: string;
  name: string;
  team: Team;
  avatar: string | null;
  tier: 1 | 2 | 3 | null;
  points: number;
};

export type TeamRow = {
  team: Team;
  display_name: string | null;
};

export const TEAM_COLORS: Record<Team, { pop: string; soft: string; text: string }> = {
  A: { pop: "#2F7BFF", soft: "#EAF1FF", text: "#1D4ED8" }, // bright blue (rad-blue family)
  B: { pop: "#9146F5", soft: "#F3EBFF", text: "#7C3AED" }, // bright violet (rad-purple family)
};

export const POINTS_COLOR = "#22C55E"; // bright green (rad-green family)
export const CELEBRATE_COLOR = "#FACC15"; // bright gold (rad-yellow family)

export const AVATAR_OPTIONS = [
  "🤖", "🚀", "⚡", "🦾", "🔥", "🌟", "🦄", "🐉", "🎮", "🧠", "🛸", "🐙",
];

export const TIERS: { value: 1 | 2 | 3; label: string; emoji: string }[] = [
  { value: 1, label: "Foundation", emoji: "🌱" },
  { value: 2, label: "Core", emoji: "⚙️" },
  { value: 3, label: "Stretch", emoji: "🚀" },
];

export function teamLabel(team: Team, teams: TeamRow[]): string {
  const row = teams.find((t) => t.team === team);
  return row?.display_name?.trim() || `Team ${team}`;
}
