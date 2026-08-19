import { apiRequest } from '@/services/api';

export type AttendanceRecord = {
  id: string;
  guardId: string;
  siteId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  syncStatus?: string;
  supervisorApproved: boolean;
  remarks?: string | null;
};

export async function listAttendance(
  siteId: string,
  supervisorApproved?: boolean,
): Promise<AttendanceRecord[]> {
  const q = new URLSearchParams({ siteId });
  if (supervisorApproved !== undefined) {
    q.set('supervisorApproved', String(supervisorApproved));
  }
  const rows = await apiRequest<AttendanceRecord[]>(`/attendance?${q}`);
  return Array.isArray(rows) ? rows : [];
}

export async function approveAttendance(
  id: string,
): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>(`/attendance/${id}/approve`, {
    method: 'POST',
  });
}

export async function supervisorClockIn(body: {
  guardId: string;
  siteId: string;
  shiftId?: string;
  remarks?: string;
}): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>('/attendance/supervisor-clock-in', {
    method: 'POST',
    body,
  });
}
