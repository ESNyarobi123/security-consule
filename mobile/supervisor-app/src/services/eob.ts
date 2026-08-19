import { apiRequest } from '@/services/api';

export type EobEntry = {
  id: string;
  siteId: string;
  category: string;
  description: string;
  officerId?: string | null;
  officerName?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  isCurrent?: boolean;
  recordedAt?: string;
  createdAt?: string;
  occurredAt?: string;
};

export async function listEob(siteId: string): Promise<EobEntry[]> {
  const rows = await apiRequest<EobEntry[]>(
    `/occurrence-book?siteId=${encodeURIComponent(siteId)}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createInspection(
  siteId: string,
  description: string,
): Promise<EobEntry> {
  return apiRequest<EobEntry>('/occurrence-book', {
    method: 'POST',
    body: {
      siteId,
      category: 'SUPERVISOR_COMMENT',
      description,
      recordedAt: new Date().toISOString(),
    },
  });
}

export async function createHandoverNote(
  siteId: string,
  description: string,
): Promise<EobEntry> {
  return apiRequest<EobEntry>('/occurrence-book', {
    method: 'POST',
    body: {
      siteId,
      category: 'HANDOVER_NOTE',
      description,
      recordedAt: new Date().toISOString(),
    },
  });
}

export async function approveEob(id: string): Promise<EobEntry> {
  return apiRequest<EobEntry>(`/occurrence-book/${id}/approve`, {
    method: 'POST',
  });
}
