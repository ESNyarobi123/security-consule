import { apiRequest } from '@/services/api';

export type PatrolRoute = {
  id: string;
  siteId: string;
  name: string;
  coverageStatus?: string;
  slaStatus?: string;
  scannedToday?: number;
  checkpointCount?: number;
  dueAt?: string;
};

export type PatrolScan = {
  id: string;
  guardId: string;
  siteId: string;
  checkpointCode?: string | null;
  checkpointName?: string | null;
  scannedAt: string;
  method?: string;
};

export async function listPatrolRoutes(siteId: string): Promise<PatrolRoute[]> {
  const q = new URLSearchParams({ siteId });
  const rows = await apiRequest<PatrolRoute[]>(
    `/operations/patrol-routes?${q}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listPatrolScans(siteId: string): Promise<PatrolScan[]> {
  const q = new URLSearchParams({ siteId });
  const rows = await apiRequest<PatrolScan[]>(`/attendance/patrols?${q}`);
  return Array.isArray(rows) ? rows : [];
}

export async function markRouteMissed(id: string): Promise<unknown> {
  return apiRequest(`/operations/patrol-routes/${id}/mark-missed`, {
    method: 'POST',
  });
}
