import { apiRequest } from '@/services/api';

export type ShiftAssignment = {
  id: string;
  guardId: string;
  employeeNumber?: string | null;
  status: string;
  supervisorId?: string | null;
  assignedAt: string;
};

export type Shift = {
  id: string;
  siteId: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  assignments?: ShiftAssignment[];
};

export type Deployment = {
  id: string;
  guardId: string;
  siteId: string;
  status: string;
  contractNumber?: string | null;
  startDate: string;
  endDate?: string | null;
};

export async function listShifts(siteId: string): Promise<Shift[]> {
  const q = new URLSearchParams({ siteId });
  const rows = await apiRequest<Shift[]>(`/operations/shifts?${q}`);
  return Array.isArray(rows) ? rows : [];
}

export async function confirmAssignment(
  shiftId: string,
  assignmentId: string,
): Promise<Shift> {
  return apiRequest<Shift>(
    `/operations/shifts/${shiftId}/assignments/${assignmentId}/confirm`,
    { method: 'POST' },
  );
}

export async function replaceAssignment(
  shiftId: string,
  assignmentId: string,
  replacementGuardId: string,
): Promise<Shift> {
  return apiRequest<Shift>(
    `/operations/shifts/${shiftId}/assignments/${assignmentId}/replace`,
    { method: 'POST', body: { replacementGuardId } },
  );
}

export async function listDeployments(): Promise<Deployment[]> {
  const rows = await apiRequest<Deployment[]>('/operations/deployments');
  return Array.isArray(rows) ? rows : [];
}
