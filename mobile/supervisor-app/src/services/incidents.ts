import { apiRequest } from '@/services/api';

export type IncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED';

export type Incident = {
  id: string;
  siteId: string;
  incidentNumber?: string;
  category?: string;
  severity?: string;
  status: IncidentStatus | string;
  title: string;
  description?: string;
  createdAt?: string;
};

export async function listIncidents(siteId: string): Promise<Incident[]> {
  const rows = await apiRequest<Incident[]>(
    `/incidents?siteId=${encodeURIComponent(siteId)}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function updateStatus(
  id: string,
  status: IncidentStatus,
): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
