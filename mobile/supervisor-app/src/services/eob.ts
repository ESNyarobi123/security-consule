import { apiRequest } from '@/services/api';

export type EobEntry = {
  id: string;
  siteId: string;
  category: string;
  description: string;
  officerId?: string;
  createdAt?: string;
  occurredAt?: string;
};

export async function listEob(siteId: string): Promise<EobEntry[]> {
  const rows = await apiRequest<EobEntry[]>(
    `/occurrence-book?siteId=${encodeURIComponent(siteId)}`,
  );
  return Array.isArray(rows) ? rows : [];
}
