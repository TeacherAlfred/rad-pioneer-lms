/**
 * Strava's `average_cadence` for runs is SINGLE-LEG (one foot's steps per
 * minute), not total steps/min - a well-known API gotcha. Values are
 * stored in fitness_activities exactly as Strava returns them (never
 * doubled at write time) so the raw column stays an honest passthrough of
 * the source API. Doubling + labeling happens only here, at render time,
 * so every page that shows cadence agrees on the convention.
 */
export function formatCadence(avgCadenceSingleLeg: number | null | undefined): string | null {
  if (avgCadenceSingleLeg == null) return null;
  const total = Math.round(avgCadenceSingleLeg * 2);
  return `${total} spm (both legs)`;
}
