import { newClientEventId } from '@/lib/uuid';
import { enqueueAlertnessConfirm } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { apiRequest } from '@/services/api';
import {
  formatGpsLabel,
  getFieldGps,
  type FieldGps,
} from '@/services/location';

export type PendingAlertnessCheck = {
  id: string;
  guardId: string;
  siteId: string;
  scheduledAt: string;
  status: string;
  referenceNumber?: string | null;
  /** Module 10-A — confirm after due records LATE */
  pastDue?: boolean;
};

export async function fetchPendingAlertness(): Promise<PendingAlertnessCheck[]> {
  const rows = await apiRequest<PendingAlertnessCheck[]>(
    '/attendance/alertness/pending',
  );
  return Array.isArray(rows) ? rows : [];
}

export async function enqueueConfirmAlertness(
  alertnessCheckId: string,
): Promise<{ row: OutboxRow; gps: FieldGps }> {
  const gps = await getFieldGps({ allowFallback: true });
  const row = await enqueueAlertnessConfirm({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    alertnessCheckId,
    latitude: gps.latitude,
    longitude: gps.longitude,
  });
  return { row, gps };
}

export { formatGpsLabel };
