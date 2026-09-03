export type RangeKey = '7d' | '4w' | '12w' | '26w' | 'all';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '4w', label: '4W' },
  { key: '12w', label: '12W' },
  { key: '26w', label: '26W' },
  { key: 'all', label: 'All' },
];

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '4w': 28, '12w': 84, '26w': 182 };

/** Returns an ISO cutoff timestamp for the given range, or null for 'all' (no lower bound). */
export function rangeToCutoffIso(range: RangeKey, now: Date = new Date()): string | null {
  if (range === 'all') return null;
  const days = RANGE_DAYS[range];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function isRangeKey(value: string | null | undefined): value is RangeKey {
  return !!value && RANGE_OPTIONS.some((r) => r.key === value);
}
