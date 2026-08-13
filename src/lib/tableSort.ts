export type SortDirection = 'asc' | 'desc';

// Generic column-agnostic sort for admin tables - numeric fields compare
// numerically, everything else falls back to case-insensitive string
// comparison. Nulls/undefined always sort last regardless of direction,
// so an empty field doesn't jump to the top on a descending sort.
export function sortRows<T extends Record<string, any>>(
  rows: T[],
  column: string | null,
  direction: SortDirection
): T[] {
  if (!column) return rows;
  return [...rows].sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'asc' ? av - bv : bv - av;
    }

    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return direction === 'asc' ? -1 : 1;
    if (as > bs) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}
