import {
  DEVICE_TIME_DISCLAIMER,
  GPS_DISCLAIMER,
} from '@/constants/config';
import { newClientEventId } from '@/lib/uuid';
import { enqueueClockIn } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import {
  formatGpsLabel,
  getFieldGps,
  type FieldGps,
} from '@/services/location';
import { resolveDemoSite } from '@/services/sites';

/**
 * Enqueue a CLOCK_IN for offline-first sync.
 * deviceTime is local clock for audit — not payroll truth.
 * GPS prefers live fix; may use cached or warehouse fallback.
 */
export async function enqueueDemoClockIn(): Promise<{
  row: OutboxRow;
  gps: FieldGps;
  disclaimer: string;
}> {
  const site = await resolveDemoSite();
  const gps = await getFieldGps({ allowFallback: true });
  const clientEventId = newClientEventId();
  const deviceTime = new Date().toISOString();

  const row = await enqueueClockIn({
    clientEventId,
    deviceTime,
    siteId: site.id,
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
