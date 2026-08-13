export type Track = "beginner" | "advanced";

export interface CodeSample {
  blocks: string;
  python: string;
}

export interface TryIt {
  /** 1 = warm-up tweak, 2 = level up, 3 = open-ended challenge. */
  tier: 1 | 2 | 3;
  prompt: string;
}

export interface TrackContent {
  goal: string;
  instructions: string[];
  code: CodeSample;
  /** Exactly 3, scaffolded from a guided tweak to an open-ended challenge. */
  tryIts: [TryIt, TryIt, TryIt];
}

export interface ModuleContent {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  when: "workshop" | "take-home";
  coreConcept: { name: string; description: string };
  tracks: Record<Track, TrackContent>;
}

export interface ScheduleRow {
  time: string;
  segment: string;
  detail: string;
}

export interface ConceptRefRow {
  concept: string;
  meaning: string;
  example: string;
}

/** Step id used for progress tracking: `${moduleId}-${track}`. */
export function stepId(moduleId: string, track: Track): string {
  return `${moduleId}-${track}`;
}
