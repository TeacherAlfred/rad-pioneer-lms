/** Monday-start week bucketing, shared by the Overview aggregation and the ultra training-load view so both agree on the same week boundaries. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
