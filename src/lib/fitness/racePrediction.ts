// Pure, DB-free race-time prediction so it's directly unit-testable.

export const ULTRA_THRESHOLD_M = 42500; // just above 42195m so a marathon with minor course variance still buckets as "marathon", not "ultra"
export const RECENT_EFFORT_WINDOW_WEEKS = 12; // most marathon blocks run 12-16wk; wider than the Overview page's 8wk baseline window because qualifying race-pace efforts are far rarer than easy training runs
export const RIEGEL_EXPONENT = 1.06;

// Preference order most-to-least accurate as a marathon predictor: a
// Half-Marathon effort's aerobic/pacing profile is much closer to a full
// marathon's than a 5K's (which draws more on anaerobic capacity and very
// different pacing dynamics), so extrapolating from the closest available
// reference distance minimizes Riegel's known error growth as reference and
// target distances diverge.
// Confirmed against real synced data (2026-09): Strava's actual labels are
// "5K"/"10K" (capital K), not "5k"/"10k". Matching is done case-insensitively
// below anyway, as a safety net against any further casing drift Strava
// introduces - the exact-string mismatch on this constant is exactly the
// kind of "verify against real data" risk flagged when this was written.
export const BEST_EFFORT_PREFERENCE = ['Half-Marathon', '10K', '5K'] as const;

export function isUltraDistance(distanceM: number): boolean {
  return distanceM > ULTRA_THRESHOLD_M;
}

export function riegelPredict(t1Seconds: number, d1Meters: number, d2Meters: number): number {
  return t1Seconds * Math.pow(d2Meters / d1Meters, RIEGEL_EXPONENT);
}

export type BestEffortRow = { name: string; distance_m: number; moving_time_s: number; start_local: string };

export function selectBestEffortForPrediction(efforts: BestEffortRow[], asOf: Date): BestEffortRow | null {
  const cutoff = new Date(asOf.getTime() - RECENT_EFFORT_WINDOW_WEEKS * 7 * 24 * 60 * 60 * 1000);
  for (const preferredName of BEST_EFFORT_PREFERENCE) {
    const candidates = efforts.filter((e) => e.name.toLowerCase() === preferredName.toLowerCase() && new Date(e.start_local) >= cutoff);
    if (candidates.length) {
      return candidates.reduce((best, e) => (e.moving_time_s < best.moving_time_s ? e : best));
    }
  }
  return null;
}

export type PredictionResult =
  | { available: true; predicted_time_s: number; exponent: number; source_effort: BestEffortRow }
  | { available: false; reason: 'no_recent_effort'; message: string };

export function predictRaceTime(efforts: BestEffortRow[], raceDistanceM: number, asOf: Date = new Date()): PredictionResult {
  const source = selectBestEffortForPrediction(efforts, asOf);
  if (!source) {
    return {
      available: false,
      reason: 'no_recent_effort',
      message: `Not enough recent race-pace data yet — no qualifying ${BEST_EFFORT_PREFERENCE.join('/')} best effort in the last ${RECENT_EFFORT_WINDOW_WEEKS} weeks.`,
    };
  }
  return {
    available: true,
    predicted_time_s: Math.round(riegelPredict(source.moving_time_s, source.distance_m, raceDistanceM)),
    exponent: RIEGEL_EXPONENT,
    source_effort: source,
  };
}
