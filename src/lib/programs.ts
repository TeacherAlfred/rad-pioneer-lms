// Shared between the kids/programs admin API routes and their pages.
// Free-text validated here rather than a db-level enum, same pattern as
// leads.status (see funnelStages.ts).
export const PROGRAM_TYPES = ['course', 'event', 'bootcamp', 'workshop', 'other'];
export const PROGRAM_STATUSES = ['active', 'archived'];
export const ENROLLMENT_STATUSES = ['interested', 'registered', 'active', 'completed', 'withdrawn'];

export function formatLabel(str: string | null | undefined) {
  if (!str) return 'Unknown';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
