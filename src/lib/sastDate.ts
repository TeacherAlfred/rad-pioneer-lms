// Date-math helpers for "which SAST calendar day/week is this instant in",
// independent of the host process's own timezone - Vercel functions default
// to UTC, so relying on Date#getDate()/getDay() (host-local) would silently
// misbucket anything within 2 hours of midnight SAST. Same reasoning as the
// timezone gotcha noted in src/lib/billingDates.ts, just for day/week-of
// lookups instead of formatting a date-only string. South Africa has no
// DST, so a fixed +2h offset is always correct - no Intl/tz-database needed.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

function toSastShifted(d: Date): Date {
  return new Date(d.getTime() + SAST_OFFSET_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function sastDateKey(d: Date = new Date()): string {
  const s = toSastShifted(d);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

// 0 = Sunday ... 6 = Saturday, in SAST.
export function sastWeekday(d: Date = new Date()): number {
  return toSastShifted(d).getUTCDay();
}

// The Monday (YYYY-MM-DD, SAST) of the week containing the given instant.
export function sastMondayOf(d: Date = new Date()): string {
  const s = toSastShifted(d);
  const dow = s.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(s.getTime());
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}
