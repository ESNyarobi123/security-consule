import { newClientEventId } from '@/lib/uuid';
import { enqueueClockOut } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { getOpenAttendanceId } from '@/services/duty-state';
import {
  formatGpsLabel,
  getFieldGps,
  type FieldGps,
} from '@/services/location';

/**
 * Enqueue CLOCK_OUT for the open attendance from last synced CLOCK_IN.
 * GPS prefers live fix; may use cached or warehouse fallback.
 */
export async function enqueueDemoClockOut(): Promise<{
  row: OutboxRow;
  gps: FieldGps;
}> {
  const attendanceId = await getOpenAttendanceId();
  if (!attendanceId) {
    throw new Error(
      'No open attendance — sync a CLOCK_IN first (or clock in again).',
    );
  }

  const gps = await getFieldGps({ allowFallback: true });

  const row = await enqueueClockOut({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    attendanceId,
    latitude: gps.latitude,
    longitude: gps.longitude,
  });

  return { row, gps };
}

export { formatGpsLabel };
