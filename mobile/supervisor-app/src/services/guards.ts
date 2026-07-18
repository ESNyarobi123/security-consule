import { apiRequest } from '@/services/api';

export type GuardSummary = {
  id: string;
  userId?: string;
  employeeNumber?: string;
  fullName?: string;
  status?: string;
};

/** Optional name map for attendance / alert rows. */
export async function listGuards(): Promise<GuardSummary[]> {
  const rows = await apiRequest<GuardSummary[]>('/guards');
  return Array.isArray(rows) ? rows : [];
}

export function guardNameMap(
  guards: GuardSummary[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of guards) {
    const label =
      g.fullName ||
      g.employeeNumber ||
      (g.id ? `Guard ${g.id.slice(0, 8)}` : 'Guard');
    if (g.id) map[g.id] = label;
  }
  return map;
}
