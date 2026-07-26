/**
 * HR portal (§35.4) — admin-web `/hr`.
 *
 * Employees, leave, salary, training, discipline, transfer/exit.
 * Permission: `hr.manage`. Phase A–C (ESS / docs later).
 */
import { authHeaders, clearSession, getRefreshToken, setTokens } from '@pssms/auth';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4001';

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiEnvelope<{
          accessToken: string;
          refreshToken: string;
        }>;
        setTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function coreFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const doFetch = (authToken?: string) =>
    fetch(`${coreUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(authToken ?? init?.token),
        ...init?.headers,
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !init?.token) {
    const newToken = await tryRefresh();
    if (newToken) res = await doFetch(newToken);
    if (res.status === 401 && typeof window !== 'undefined') {
      clearSession();
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  return parseEnvelope<T>(res);
}

// ── Enums (align with Prisma workforce schema) ──

export type EmployeeStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TERMINATED';

export type EmploymentType = 'GUARD' | 'SUPERVISOR' | 'ADMIN' | 'OTHER';

export type LeaveRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

// ── Employees ──

export type Employee = {
  id: string;
  organizationId: string;
  userId?: string | null;
  guardProfileId?: string | null;
  employeeNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  employmentType: EmploymentType | string;
  status: EmployeeStatus | string;
  hireDate?: string | null;
  createdAt: string;
};

export type CreateEmployeeBody = {
  employeeNumber: string;
  fullName: string;
  userId?: string;
  guardProfileId?: string;
  email?: string;
  phone?: string;
  department?: string;
  employmentType?: EmploymentType;
  hireDate?: string;
};

export type UpdateEmployeeBody = {
  email?: string;
  phone?: string;
  department?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  /** Link login for ESS; null unlinks */
  userId?: string | null;
};

export const listEmployees = (status?: EmployeeStatus, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<Employee[]>(`/api/v1/hr/employees${q}`, { token });
};

export const createEmployee = (body: CreateEmployeeBody, token?: string) =>
  coreFetch<Employee>('/api/v1/hr/employees', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const getEmployee = (id: string, token?: string) =>
  coreFetch<Employee>(`/api/v1/hr/employees/${id}`, { token });

export const updateEmployee = (
  id: string,
  body: UpdateEmployeeBody,
  token?: string,
) =>
  coreFetch<Employee>(`/api/v1/hr/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

// ── Leave types ──

export type LeaveType = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  annualQuotaDays: number;
  isActive: boolean;
};

export type CreateLeaveTypeBody = {
  code: string;
  name: string;
  annualQuotaDays?: number;
};

export const listLeaveTypes = (token?: string) =>
  coreFetch<LeaveType[]>('/api/v1/hr/leave/types', { token });

export const createLeaveType = (body: CreateLeaveTypeBody, token?: string) =>
  coreFetch<LeaveType>('/api/v1/hr/leave/types', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Leave requests ──

export type LeaveRequest = {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus | string;
  approvalInstanceId?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
};

export type CreateLeaveRequestBody = {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
};

export const listLeaveRequests = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<LeaveRequest[]>(`/api/v1/hr/leave/requests${q}`, { token });
};

export const createLeaveRequest = (
  body: CreateLeaveRequestBody,
  token?: string,
) =>
  coreFetch<LeaveRequest>('/api/v1/hr/leave/requests', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const approveLeaveRequest = (id: string, token?: string) =>
  coreFetch<LeaveRequest>(`/api/v1/hr/leave/requests/${id}/approve`, {
    method: 'POST',
    token,
  });

export const rejectLeaveRequest = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<LeaveRequest>(`/api/v1/hr/leave/requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

// ── Salary assignments ──

export type SalaryAssignment = {
  id: string;
  organizationId: string;
  employeeId: string;
  basicSalary: number;
  currency: string;
  hourlyRate?: number | null;
  allowances?: unknown;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateSalaryAssignmentBody = {
  employeeId: string;
  basicSalary: number;
  currency?: string;
  hourlyRate?: number;
  allowances?: Record<string, number>;
  effectiveFrom: string;
};

export const listSalaryAssignments = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<SalaryAssignment[]>(
    `/api/v1/hr/salary/assignments${q}`,
    { token },
  );
};

export const createSalaryAssignment = (
  body: CreateSalaryAssignmentBody,
  token?: string,
) =>
  coreFetch<SalaryAssignment>('/api/v1/hr/salary/assignments', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Org users for ESS login linking — HR-scoped (`hr.manage`). */
export type OrgUser = {
  id: string;
  email: string;
  fullName: string;
  isActive?: boolean;
};

export const listOrgUsers = (token?: string) =>
  coreFetch<OrgUser[]>('/api/v1/hr/employees/linkable-users', { token });

// ── Training ──

export type TrainingStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';

export type TrainingRecord = {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string;
  provider?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: TrainingStatus | string;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type CreateTrainingRecordBody = {
  employeeId: string;
  title: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  status?: TrainingStatus;
  notes?: string;
};

export type UpdateTrainingRecordBody = {
  title?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  status?: TrainingStatus;
  notes?: string;
};

export const listTrainingRecords = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<TrainingRecord[]>(`/api/v1/hr/training/records${q}`, {
    token,
  });
};

export const createTrainingRecord = (
  body: CreateTrainingRecordBody,
  token?: string,
) =>
  coreFetch<TrainingRecord>('/api/v1/hr/training/records', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateTrainingRecord = (
  id: string,
  body: UpdateTrainingRecordBody,
  token?: string,
) =>
  coreFetch<TrainingRecord>(`/api/v1/hr/training/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

// ── Discipline ──

export type DisciplineSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DisciplineStatus = 'OPEN' | 'CLOSED';

export type DisciplineCase = {
  id: string;
  organizationId: string;
  employeeId: string;
  incidentDate: string;
  category: string;
  severity: DisciplineSeverity | string;
  description: string;
  status: DisciplineStatus | string;
  outcome?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type CreateDisciplineCaseBody = {
  employeeId: string;
  incidentDate: string;
  category: string;
  severity?: DisciplineSeverity;
  description: string;
};

export type UpdateDisciplineCaseBody = {
  status?: DisciplineStatus;
  outcome?: string;
  severity?: DisciplineSeverity;
  description?: string;
};

export const listDisciplineCases = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<DisciplineCase[]>(`/api/v1/hr/discipline/cases${q}`, {
    token,
  });
};

export const createDisciplineCase = (
  body: CreateDisciplineCaseBody,
  token?: string,
) =>
  coreFetch<DisciplineCase>('/api/v1/hr/discipline/cases', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateDisciplineCase = (
  id: string,
  body: UpdateDisciplineCaseBody,
  token?: string,
) =>
  coreFetch<DisciplineCase>(`/api/v1/hr/discipline/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

// ── Movements (transfer / exit) ──

export type MovementType = 'TRANSFER' | 'EXIT';
export type MovementStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type EmployeeMovement = {
  id: string;
  organizationId: string;
  employeeId: string;
  type: MovementType | string;
  fromDepartment?: string | null;
  toDepartment?: string | null;
  effectiveDate: string;
  reason: string;
  status: MovementStatus | string;
  approvalInstanceId?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
};

export type CreateEmployeeMovementBody = {
  employeeId: string;
  type: MovementType;
  fromDepartment?: string;
  toDepartment?: string;
  effectiveDate: string;
  reason: string;
};

export const listEmployeeMovements = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<EmployeeMovement[]>(`/api/v1/hr/movements${q}`, { token });
};

export const createEmployeeMovement = (
  body: CreateEmployeeMovementBody,
  token?: string,
) =>
  coreFetch<EmployeeMovement>('/api/v1/hr/movements', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const approveEmployeeMovement = (id: string, token?: string) =>
  coreFetch<EmployeeMovement>(`/api/v1/hr/movements/${id}/approve`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const rejectEmployeeMovement = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<EmployeeMovement>(`/api/v1/hr/movements/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });
