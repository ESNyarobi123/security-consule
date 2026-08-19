import { apiRequest } from '@/services/api';

export type AlertnessCheck = {
  id: string;
  guardId: string;
  siteId: string;
  status: string;
  scheduledAt: string;
  confirmedAt?: string | null;
  pastDue?: boolean;
  employeeNumber?: string | null;
  siteCode?: string | null;
  supervisorRemarks?: string | null;
};

export async function listPendingAlertness(
  siteId: string,
): Promise<AlertnessCheck[]> {
  const q = new URLSearchParams({ siteId });
  const rows = await apiRequest<AlertnessCheck[]>(
    `/attendance/alertness/pending?${q}`,
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((r) => r.siteId === siteId);
}

export async function listAlertnessHistory(
  siteId: string,
): Promise<AlertnessCheck[]> {
  const q = new URLSearchParams({ siteId, take: '40' });
  const rows = await apiRequest<AlertnessCheck[]>(
    `/attendance/alertness/history?${q}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function markAlertnessMissed(
  id: string,
  supervisorRemarks?: string,
): Promise<AlertnessCheck> {
  return apiRequest<AlertnessCheck>(`/attendance/alertness/${id}/missed`, {
    method: 'POST',
    body: supervisorRemarks ? { supervisorRemarks } : {},
  });
}
