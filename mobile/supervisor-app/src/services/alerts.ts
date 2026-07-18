import { apiRequest } from '@/services/api';

export type FieldAlert = {
  id: string;
  siteId: string;
  guardId?: string | null;
  alertType: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  createdAt: string;
};

export async function listFieldAlerts(
  siteId: string,
  acknowledged?: boolean,
): Promise<FieldAlert[]> {
  const q = new URLSearchParams({ siteId });
  if (acknowledged !== undefined) {
    q.set('acknowledged', String(acknowledged));
  }
  const rows = await apiRequest<FieldAlert[]>(
    `/attendance/field-alerts?${q}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function acknowledgeAlert(id: string): Promise<FieldAlert> {
  return apiRequest<FieldAlert>(
    `/attendance/field-alerts/${id}/acknowledge`,
    { method: 'POST' },
  );
}
