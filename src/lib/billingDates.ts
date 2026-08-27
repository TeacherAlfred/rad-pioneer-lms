// Date-only (YYYY-MM-DD) helpers for recurring billing due dates.
//
// Deliberately avoid Date#toISOString() for these - it serialises in UTC,
// so a local midnight built via `new Date(y, m, d)` in a UTC+ timezone
// (e.g. SAST, UTC+2) rolls back to the previous calendar day once
// converted to UTC. Formatting from the local y/m/d fields directly sidesteps
// that entirely.
function toISODateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function lastDayOfMonthISO(reference: Date = new Date()): string {
  return toISODateString(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
}

// Advances a YYYY-MM-DD string by one calendar month, clamped to the target
// month's actual length (e.g. Jan 31 -> Feb 28, not Mar 3).
export function addOneMonthISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const daysInTargetMonth = new Date(y, m + 1, 0).getDate();
  return toISODateString(new Date(y, m, Math.min(d, daysInTargetMonth)));
}
