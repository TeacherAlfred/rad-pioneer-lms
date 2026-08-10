// Canonical class-name mapping for the Phase 0 Irene data migration.
// Built from a full breakdown of the 625 raw (grade, class_name) combos in
// Neon's proj_irene_responses (OCR-transcribed, hence the typos/variants).
//
// HOW TO USE THIS FILE:
// - `confidentAliases`: spelling/spacing/case variants of a class that's
//   otherwise unambiguous in the data (e.g. "4 A" vs "4A", both clearly the
//   same class). Safe to apply automatically.
// - `needsReview`: raw combos where I can't confidently infer the real
//   classroom from the data alone — either genuinely ambiguous (multiple
//   plausible classes), or a large "unlabelled" cluster. These are NOT
//   guessed. Review each `note` and either (a) tell me the right canonical
//   mapping and I'll move it into confidentAliases, or (b) confirm it should
//   stay flagged for manual per-record lookup against the physical forms
//   during Data Reconciliation.
//
// One cluster below is still large and worth your attention:
//   - Grade R / "R" (49 rows) — no specific classroom captured at all, could
//     be Mickey Mouse, Smurfs, or Spongebob. This is the single biggest
//     unresolved bucket.
// ("Grade 10" / "10" was confirmed by the school to be Grade 1, class "O" —
// resolved, moved into confidentAliases.)

export const confidentAliases = [
  // Grade 1
  { raw_grade: 'Grade 1', raw_class_name: '4p', canonical_grade: 'Grade 4', canonical_class_name: '4P', note: 'stray Grade-4 row, lowercase — keep as Grade 4, not Grade 1' },
  { raw_grade: 'Grade 10', raw_class_name: '10', canonical_grade: 'Grade 1', canonical_class_name: '1O', note: 'confirmed by school — this is Grade 1, class "O", not a real "Grade 10". Merges into the existing small 1O cluster (2 rows) for 21 total.' },
  { raw_grade: 'Grade 1', raw_class_name: '1(0)', canonical_grade: 'Grade 1', canonical_class_name: '1O', note: 'same "1O" misread pattern as the confirmed "Grade 10" cluster above — moved on the strength of that confirmation, flag if wrong' },

  // Grade 2 — "2LS" spacing variants
  { raw_grade: 'Grade 2', raw_class_name: '2 Ls', canonical_grade: 'Grade 2', canonical_class_name: '2LS' },
  { raw_grade: 'Grade 2', raw_class_name: '2 LS', canonical_grade: 'Grade 2', canonical_class_name: '2LS' },

  // Grade 4 — "4A" spacing/case variants
  { raw_grade: 'Grade 4', raw_class_name: '4 A', canonical_grade: 'Grade 4', canonical_class_name: '4A' },
  { raw_grade: 'Grade A', raw_class_name: '4A', canonical_grade: 'Grade 4', canonical_class_name: '4A', note: 'grade itself was misOCR\'d as "Grade A" — class name confirms it is Grade 4' },

  // Grade 5 — truncated single-letter variants of an otherwise-dominant class
  { raw_grade: 'Grade 5', raw_class_name: 'G', canonical_grade: 'Grade 5', canonical_class_name: '5G', note: 'truncated "5G" (42 rows already confirm 5G is real and dominant)' },
  { raw_grade: 'Grade 5', raw_class_name: '5 S', canonical_grade: 'Grade 5', canonical_class_name: '5S' },
  { raw_grade: 'Grade 5', raw_class_name: 'N', canonical_grade: 'Grade 5', canonical_class_name: '5N', note: 'truncated "5N"' },
  { raw_grade: 'Grade 5', raw_class_name: 'F5N', canonical_grade: 'Grade 5', canonical_class_name: '5N', note: 'garbled OCR of "5N"' },
  { raw_grade: 'Grade 5', raw_class_name: 'J', canonical_grade: 'Grade 5', canonical_class_name: '5J', note: 'truncated "5J"' },

  // Grade 6
  { raw_grade: 'Grade 6', raw_class_name: 'AH', canonical_grade: 'Grade 6', canonical_class_name: '6AH', note: 'truncated "6AH"' },

  // Grade R — Smurfs / Spongebob spelling variants (matches Supabase's known 3 Grade R classes)
  { raw_grade: 'Grade R', raw_class_name: 'R-Smurfs', canonical_grade: 'Grade R', canonical_class_name: 'Smurfs' },
  { raw_grade: 'Grade R', raw_class_name: 'R smurfs', canonical_grade: 'Grade R', canonical_class_name: 'Smurfs' },
  { raw_grade: 'Grade R', raw_class_name: 'R Smurf', canonical_grade: 'Grade R', canonical_class_name: 'Smurfs' },
  { raw_grade: 'Grade R', raw_class_name: 'R Spongebob', canonical_grade: 'Grade R', canonical_class_name: 'Spongebob' },
  { raw_grade: 'Grade R', raw_class_name: 'Grp Spongebob', canonical_grade: 'Grade R', canonical_class_name: 'Spongebob' },
];

export const needsReview = [
  // --- Grade 1 ---
  { raw_grade: 'Grade 1', raw_class_name: '1', count: 12, note: 'generic — no specific classroom letter captured. Real Grade 1 classes seen elsewhere: 1P, 1T, 1W, 1A, 1O, 1D, 1I.' },
  { raw_grade: 'Grade 1', raw_class_name: '1VA', count: 2, note: 'could be a typo of 1A, or a genuine class — unclear.' },
  { raw_grade: 'Grade 1', raw_class_name: '1 SB', count: 1, note: 'possibly "1B"? no 1B seen elsewhere in the data to confirm against.' },

  // --- Grade 2 ---
  { raw_grade: 'Grade 2', raw_class_name: '2', count: 13, note: 'generic — no specific classroom letter. Real Grade 2 classes seen: 2B, 2LS, 2L, 2A, 2KS, 2S.' },
  { raw_grade: 'Grade 2', raw_class_name: '02', count: 1, note: 'likely same generic-"2" issue.' },
  { raw_grade: 'Grade 2', raw_class_name: '2S/A', count: 1, note: 'ambiguous between 2S and 2A.' },

  // --- Grade 3 ---
  { raw_grade: 'Grade 3', raw_class_name: '3', count: 2, note: 'generic — Grade 3 is otherwise clean (3V, 3K, 3B, 3M all clear).' },

  // --- Grade 4 ---
  { raw_grade: 'Grade 4', raw_class_name: '4', count: 4, note: 'generic — no specific classroom letter.' },
  { raw_grade: 'Grade 4', raw_class_name: '4ND', count: 1, note: 'unclear — no other "4ND"/similar to corroborate.' },
  { raw_grade: 'Grade 4', raw_class_name: '4E', count: 1, note: 'unclear — no other "4E" to corroborate.' },

  // --- Grade 5 ---
  { raw_grade: 'Grade 5', raw_class_name: '5', count: 2, note: 'generic.' },
  { raw_grade: 'Grade 5', raw_class_name: '5J/6H', count: 1, note: 'looks like a genuinely dual-class entry (team-taught, or two siblings\' classes merged into one field) — needs a human look, not an auto-split.' },

  // --- Grade 6 ---
  { raw_grade: 'Grade 6', raw_class_name: '6', count: 1, note: 'generic.' },

  // --- Grade 7 ---
  { raw_grade: 'Grade 7', raw_class_name: '7', count: 4, note: 'generic — real Grade 7 classes are otherwise clean (7J, 7S, 7AS, 7R, 7A).' },
  { raw_grade: 'Grade 7', raw_class_name: '', count: 1, note: 'blank class_name entirely.' },

  // --- The other big one: Grade R "R" ---
  { raw_grade: 'Grade R', raw_class_name: 'R', count: 49, note: 'LARGE CLUSTER. No specific classroom captured at all — could be Mickey Mouse, Smurfs, or Spongebob (the 3 known Grade R classes, per the Supabase pilot batch). This is the single biggest unresolved bucket in the whole dataset.' },
  { raw_grade: 'Grade R', raw_class_name: 'R(S)', count: 1, note: '"(S)" could mean Smurfs or Spongebob — both start with S.' },
  { raw_grade: 'Grade R', raw_class_name: 'RG', count: 1, note: 'unclear abbreviation — possibly a 4th class, possibly noise.' },
  { raw_grade: 'Grade RR', raw_class_name: 'RR', count: 1, note: 'likely a doubled-letter OCR artifact for Grade R — but which classroom is still unknown, same as the "R" bucket above.' },
  { raw_grade: 'Grade N', raw_class_name: 'N', count: 1, note: 'possibly another truncated "5N" (see Grade 5 pattern above) — but "Grade N" as the grade itself is also OCR noise, less certain than the in-Grade-5 "N" cases.' },
  { raw_grade: 'Grade 0', raw_class_name: '00', count: 1, note: 'possibly "Grade R" under an alternate "Grade 0" naming convention used at some SA schools — unconfirmed.' },
  { raw_grade: '', raw_class_name: '', count: 1, note: 'completely blank — grade and class both missing. Needs the physical form.' },
];
