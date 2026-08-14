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

export type IncidentStatusUpdate =
  | { status: 'OPEN' | 'INVESTIGATING' }
  | { status: 'RESOLVED'; resolution: string; actionTaken?: string }
  | {
      status: 'CLOSED';
      resolution: string;
      closureApprovalNote: string;
      actionTaken?: string;
    };

export async function updateStatus(
  id: string,
  update: IncidentStatusUpdate,
): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${id}/status`, {
    method: 'PATCH',
    body: update,
  });
}
