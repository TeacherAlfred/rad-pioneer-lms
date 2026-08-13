import type { Track } from "./content/types";

export interface TrackTheme {
  label: string;
  icon: string;
  primary: string;
  primarySoft: string;
  accent: string;
  glow: string;
}

export const TRACK_THEME: Record<Track, TrackTheme> = {
  beginner: {
    label: "Explorer",
    icon: "🌱",
    primary: "#88be56", // rad-green
    primarySoft: "#88be5626",
    accent: "#45a79a", // rad-teal
    glow: "rgba(136, 190, 86, 0.35)",
  },
  advanced: {
    label: "Master",
    icon: "👑",
    primary: "#5d4385", // rad-purple
    primarySoft: "#5d438533",
    accent: "#d7a94a", // rad-yellow
    glow: "rgba(93, 67, 133, 0.45)",
  },
};
