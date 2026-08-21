// Ordered, extensible qualification stages (design doc §3.1b). Add a new
// stage here when a new disqualifying pattern is found - never redefine or
// remove an existing key, since lead_qualification_checks rows reference
// stage_key directly and past checks need to keep meaning what they meant
// when they were made. Each stage after the first only makes sense to check
// once the prior stage has passed (sequential, not independent booleans).
export const QUALIFICATION_STAGES: { key: string; label: string; question: string; passLabel: string; failLabel: string }[] = [
  { key: 'respondent_is_parent', label: 'Respondent is parent', question: 'Who is the respondent?', passLabel: 'Parent', failLabel: 'Child' },
  { key: 'child_age_fits_program', label: 'Child age fits program', question: "Does the child's age realistically fit the program?", passLabel: 'Yes', failLabel: 'No' },
];

export type QualificationCheck = { stage_key: string; passed: boolean };

// A lead is "qualified" = passed every CURRENTLY-DEFINED stage. A lead with
// no check at all for a stage counts as not-yet-qualified for that stage
// (fails open to "unqualified" rather than assuming a pass) - this is what
// lets the qualified-lead bar get stricter over time as stages are added,
// per the doc's explicit design consequence.
export function isLeadQualified(checks: QualificationCheck[]): boolean {
  return QUALIFICATION_STAGES.every((stage) => checks.some((c) => c.stage_key === stage.key && c.passed));
}

// Which stage should the admin see/act on next - the first stage with no
// check yet, or null if every current stage already passed (fully
// qualified) or a prior stage failed (sequence stops, later stages moot).
export function nextStageToCheck(checks: QualificationCheck[]): string | null {
  for (const stage of QUALIFICATION_STAGES) {
    const check = checks.find((c) => c.stage_key === stage.key);
    if (!check) return stage.key;
    if (!check.passed) return null; // sequence broken - stop here
  }
  return null; // all stages passed
}
