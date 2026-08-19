import {
  DEVICE_TIME_DISCLAIMER,
  GPS_DISCLAIMER,
} from '@/constants/config';
import { newClientEventId } from '@/lib/uuid';
import { enqueueClockIn } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { getMyDuty } from '@/services/duty';
import {
  formatGpsLabel,
  getFieldGps,
  type FieldGps,
} from '@/services/location';
import { resolveDutySite } from '@/services/sites';

/**
 * Enqueue a CLOCK_IN for offline-first sync.
 * Uses assigned duty site + shift (not a hardcoded warehouse code).
 */
export async function enqueueDemoClockIn(): Promise<{
  row: OutboxRow;
  gps: FieldGps;
  disclaimer: string;
}> {
  const [site, duty, gps] = await Promise.all([
    resolveDutySite(),
    getMyDuty().catch(() => null),
    getFieldGps({ allowFallback: true }),
  ]);
  const clientEventId = newClientEventId();
  const deviceTime = new Date().toISOString();

  const row = await enqueueClockIn({
    clientEventId,
    deviceTime,
    siteId: site.id,
    shiftId: duty?.shift?.id,
    latitude: gps.latitude,
    longitude: gps.longitude,
  });

  return {
    row,
    gps,
    disclaimer: `${DEVICE_TIME_DISCLAIMER} ${GPS_DISCLAIMER}`,
  };
}

export { formatGpsLabel };
