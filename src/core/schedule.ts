/**
 * Next moment that falls on `weekday` (1 = Sunday … 7 = Saturday) at
 * `hour`:00 local time and is at least `minLeadMs` after `now`.
 */
export function nextWeeklyTime(now: number, weekday: number, hour: number, minLeadMs = 60 * 60 * 1000): Date {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  const todayWeekday = target.getDay() + 1;
  target.setDate(target.getDate() + ((weekday - todayWeekday + 7) % 7));
  while (target.getTime() - now < minLeadMs) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}
