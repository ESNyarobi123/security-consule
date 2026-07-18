import {
  DEMO_GPS,
  DEVICE_TIME_DISCLAIMER,
} from '@/constants/config';
import { newClientEventId } from '@/lib/uuid';
import { enqueueClockIn } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { resolveDemoSite } from '@/services/sites';

/**
 * Enqueue a CLOCK_IN for offline-first sync.
 * deviceTime is local clock for audit — not payroll truth.
 */
export async function enqueueDemoClockIn(): Promise<{
  row: OutboxRow;
  disclaimer: string;
}> {
  const site = await resolveDemoSite();
  const clientEventId = newClientEventId();
  const deviceTime = new Date().toISOString();

  const row = await enqueueClockIn({
    clientEventId,
    deviceTime,
    siteId: site.id,
    latitude: DEMO_GPS.latitude,
    longitude: DEMO_GPS.longitude,
  });

  return { row, disclaimer: DEVICE_TIME_DISCLAIMER };
}
