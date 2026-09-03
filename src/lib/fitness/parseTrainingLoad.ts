export type ParsedTrainingLoad = {
  mileage_flag: string | null;
  run_health: string | null;
  injury_risk: 'low' | 'moderate' | 'high' | null;
  acr_percent: number | null;
};

/**
 * Best-effort parser for the myTF.run (via Huawei Health) training-load
 * commentary that shows up inside Strava's free-text `description` field
 * on synced activities, e.g.:
 *
 *   "Run health: 🟢 good and fitness improving • Risk of injury: low • ACR:125%"
 *
 * This is confirmed against exactly ONE real example string as of 2026-09.
 * Each field is matched independently against the full string (not by
 * sequentially splitting on a fixed delimiter) so that if myTF.run reorders
 * fields, changes its delimiter, or adds new fields in some other
 * activity's description, this still recovers whatever it can rather than
 * failing all-or-nothing. Expect to revisit field boundaries and the
 * injury_risk vocabulary once real synced descriptions are visible - that's
 * what fitness_training_load_signals.parser_version is for.
 */
export function parseTrainingLoadSignal(descriptionRaw: string | null | undefined): ParsedTrainingLoad | null {
  if (!descriptionRaw) return null;
  if (!/run health/i.test(descriptionRaw)) return null;

  const flagMatch = descriptionRaw.match(/run health:\s*([^\sA-Za-z]+)/i);
  const mileage_flag = flagMatch ? flagMatch[1] : null;

  const healthMatch = descriptionRaw.match(/run health:\s*[^\sA-Za-z]*\s*([^•|\n]+)/i);
  const run_health = healthMatch ? healthMatch[1].trim() : null;

  const injuryMatch = descriptionRaw.match(/risk of injury:\s*(low|moderate|high)/i);
  const injury_risk = injuryMatch ? (injuryMatch[1].toLowerCase() as ParsedTrainingLoad['injury_risk']) : null;

  const acrMatch = descriptionRaw.match(/acr:?\s*(\d+(?:\.\d+)?)\s*%/i);
  const acr_percent = acrMatch ? parseFloat(acrMatch[1]) : null;

  if (!mileage_flag && !run_health && !injury_risk && acr_percent === null) return null;

  return { mileage_flag, run_health, injury_risk, acr_percent };
}
