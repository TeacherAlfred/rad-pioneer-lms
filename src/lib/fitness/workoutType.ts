export const RUN_SPORT_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const WORKOUT_TYPE_LABELS: Record<number, string> = { 0: 'default', 1: 'race', 2: 'long_run', 3: 'workout' };

/**
 * Strava's `workout_type` int uses a different vocabulary for rides
 * (10-13) than runs (0-3) - deliberately not interpreted here, since race
 * auto-detection in this app is running-only.
 */
export function normalizeWorkoutType(sportType: string, workoutType: number | null | undefined): string | null {
  if (workoutType == null) return null;
  if (!RUN_SPORT_TYPES.has(sportType)) return null;
  return WORKOUT_TYPE_LABELS[workoutType] ?? null;
}
