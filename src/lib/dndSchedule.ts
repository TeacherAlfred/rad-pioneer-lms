// Per-day Do Not Disturb schedule - deliberately separate from
// notificationBuffer.ts (which touches Supabase/service-role env vars,
// server-only) so this pure logic is safe to import from a client
// component too (the overview dashboard's "DND active right now" tile
// needs the exact same check the webhook and flush endpoints use, without
// duplicating a fourth copy of it).

// 0=Sunday .. 6=Saturday, matching native JS Date.getDay().
export type DndDay = {
  day_of_week: number;
  enabled: boolean;
  start_time: string | null;
  end_time: string | null;
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Reads day-of-week AND time-of-day from the SAME Intl call, both already
// resolved to Africa/Johannesburg - mixing a server-local `Date.getDay()`
// (UTC on Vercel) with a separately-timezone-converted time string is a
// real bug source, since JHB is UTC+2: at e.g. 22:30 UTC Sunday, it's
// already 00:30 JHB Monday, so `new Date().getDay()` alone would say
// "Sunday" while the JHB day has already rolled to Monday.
function nowInJhb(): { dayOfWeek: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday')!.value;
  const hour = parts.find(p => p.type === 'hour')!.value.padStart(2, '0');
  const minute = parts.find(p => p.type === 'minute')!.value.padStart(2, '0');
  return { dayOfWeek: DAY_SHORT.indexOf(weekday), time: `${hour}:${minute}` };
}

// True if right now falls inside a configured DND window. A day whose end
// time is earlier than its start time wraps past midnight (e.g. Monday
// 19:00-06:00) - that means checking TWO rows, not one: today's own row
// covers the evening portion (>= start), and YESTERDAY's row - if it also
// wraps - covers the early-morning portion still running into today
// (< yesterday's end). Checking today's row alone (the original version of
// this function) would require the next day to be separately configured
// with matching settings just for the overnight window to "continue" -
// wrong; Monday 19:00-06:00 should carry through to Tuesday 06:00 on
// Monday's own setting, with Tuesday's row left completely alone.
export function isWithinDnd(schedule: DndDay[]): boolean {
  const { dayOfWeek, time } = nowInJhb();

  const today = schedule.find(d => d.day_of_week === dayOfWeek);
  if (today?.enabled && today.start_time && today.end_time) {
    const start = today.start_time.slice(0, 5);
    const end = today.end_time.slice(0, 5);
    if (start <= end ? (time >= start && time < end) : time >= start) return true;
  }

  const yesterday = (dayOfWeek + 6) % 7;
  const prev = schedule.find(d => d.day_of_week === yesterday);
  if (prev?.enabled && prev.start_time && prev.end_time) {
    const start = prev.start_time.slice(0, 5);
    const end = prev.end_time.slice(0, 5);
    if (start > end && time < end) return true;
  }

  return false;
}
