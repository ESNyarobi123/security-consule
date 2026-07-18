import { DEMO_GPS } from '@/constants/config';
import { newClientEventId } from '@/lib/uuid';
import { enqueueClockOut } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { getOpenAttendanceId } from '@/services/duty-state';

/**
 * Enqueue CLOCK_OUT for the open attendance from last synced CLOCK_IN.
 */
export async function enqueueDemoClockOut(): Promise<OutboxRow> {
  const attendanceId = await getOpenAttendanceId();
  if (!attendanceId) {
    throw new Error(
      'No open attendance — sync a CLOCK_IN first (or clock in again).',
    );
  }

  return enqueueClockOut({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    attendanceId,
    latitude: DEMO_GPS.latitude,
    longitude: DEMO_GPS.longitude,
  });
}
