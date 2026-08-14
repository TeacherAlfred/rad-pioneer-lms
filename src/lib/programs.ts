// Shared between the students/programmes/sessions admin API routes and
// their pages. Free-text validated here rather than a db-level enum,
// same pattern as leads.status (see funnelStages.ts).
//
// Terminology follows RAD_Programme_Model_and_Catalogue.md: a Programme
// is curriculum (never dated/priced); a Session is one dated, priced,
// staffed delivery of a Programme. DB tables are `programs`/`kids` (not
// `programmes`/`students`) only because those names collide with the
// older profiles pipeline - see the 2026-08-14 migration comment.
export const PROGRAM_TYPES = [
  'workshop', 'term_course', 'webinar', 'holiday_programme',
  'competition', 'year_end', 'b2b_training', 'b2b_school', 'private',
];
export const AUDIENCES = ['student', 'guardian', 'teacher', 'family'];
export const PROGRAM_LEVELS = ['Foundation', 'Intermediate', 'Advanced'];

export const SESSION_STATUSES = ['draft', 'selling', 'confirmed', 'delivered', 'cancelled'];
export const ENROLMENT_STATUSES = ['interested', 'registered', 'active', 'completed', 'withdrawn'];
export const PASS_CREDIT_STATUSES = ['unredeemed', 'redeemed'];
export const ORDER_STATUSES = ['pending', 'paid', 'refunded', 'cancelled'];

export function formatLabel(str: string | null | undefined) {
  if (!str) return 'Unknown';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
