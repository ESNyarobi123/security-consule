import { DEMO_GPS } from '@/constants/config';
import { newClientEventId } from '@/lib/uuid';
import { enqueueAlertnessConfirm } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { apiRequest } from '@/services/api';

export type PendingAlertnessCheck = {
  id: string;
  guardId: string;
  siteId: string;
  scheduledAt: string;
  status: string;
  referenceNumber?: string | null;
};

export async function fetchPendingAlertness(): Promise<PendingAlertnessCheck[]> {
  const rows = await apiRequest<PendingAlertnessCheck[]>(
    '/attendance/alertness/pending',
  );
  return Array.isArray(rows) ? rows : [];
}

export async function enqueueConfirmAlertness(
  alertnessCheckId: string,
): Promise<OutboxRow> {
  return enqueueAlertnessConfirm({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    alertnessCheckId,
    latitude: DEMO_GPS.latitude,
    longitude: DEMO_GPS.longitude,
  });
}
