/** Default due = 23:00 local (23 * 60). */
export const PATROL_ROUTE_DUE_DEFAULT_MINUTES = 1380;

export type PatrolSlaStatus = 'OK' | 'ON_TRACK' | 'LATE' | 'MISSED';

export const PATROL_MISSED_ALERT_TYPE = 'PATROL_MISSED';

/** Stable token in FieldAlert.message for idempotent miss per route+day. */
export function patrolMissAlertToken(routeId: string, dayKey: string): string {
  return `[${routeId}@${dayKey}]`;
}

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dueAtForDay(
  dayStart: Date,
  dueMinutesFromMidnight: number,
): Date {
  const mins = Math.min(
    1439,
    Math.max(0, Math.floor(dueMinutesFromMidnight)),
  );
  const due = new Date(dayStart);
  due.setMinutes(due.getMinutes() + mins);
  return due;
}
