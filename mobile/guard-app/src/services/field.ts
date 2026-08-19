import { newClientEventId } from '@/lib/uuid';
import { enqueueIncident } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { apiRequest } from '@/services/api';
import { getFieldGps, type FieldGps } from '@/services/location';
import { resolveDutySite } from '@/services/sites';

export type IncidentCategoryOption = { value: string; label: string };

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export async function listIncidentCategories(): Promise<IncidentCategoryOption[]> {
  return apiRequest<IncidentCategoryOption[]>('/incidents/category-options');
}

export async function enqueueIncidentReport(input: {
  category: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
}): Promise<{ row: OutboxRow; gps: FieldGps }> {
  if (!input.title.trim()) throw new Error('Title is required');
  if (input.description.trim().length < 10) {
    throw new Error('Describe what happened (at least 10 characters)');
  }
  const site = await resolveDutySite();
  const gps = await getFieldGps({ allowFallback: true });
  const row = await enqueueIncident({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    siteId: site.id,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    severity: input.severity,
    latitude: gps.latitude,
    longitude: gps.longitude,
  });
  return { row, gps };
}

export async function raiseGuardEmergency(message?: string): Promise<{
  id: string;
  alertType: string;
  severity: string;
  message: string;
}> {
  const site = await resolveDutySite().catch(() => null);
  const gps = await getFieldGps({ allowFallback: true }).catch(() => null);
  return apiRequest('/attendance/field-alerts', {
    method: 'POST',
    body: {
      siteId: site?.id,
      message: message?.trim() || undefined,
      gps: gps
        ? { latitude: gps.latitude, longitude: gps.longitude }
        : undefined,
    },
  });
}

export type EssEquipment = {
  assignmentId: string;
  assetTag: string;
  name: string;
  category?: string | null;
  status?: string;
  confirmedAt?: string | null;
};

export async function listMyEquipment(): Promise<EssEquipment[]> {
  return apiRequest<EssEquipment[]>('/ess/equipment');
}

export async function confirmMyEquipment(
  assignmentId: string,
): Promise<EssEquipment> {
  return apiRequest<EssEquipment>(
    `/ess/equipment/${assignmentId}/confirm`,
    { method: 'POST', body: {} },
  );
}

export type EssNotice = {
  id: string;
  templateCode: string;
  channel: string;
  subject?: string | null;
  body: string;
  status: string;
  createdAt: string;
};

export async function listMyNotices(): Promise<EssNotice[]> {
  return apiRequest<EssNotice[]>('/ess/notices');
}
