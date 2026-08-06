/**
 * Branch Operations (portal 35.23) — sites, deployments, shifts, attendance board,
 * field alerts, electronic occurrence book (EOB), patrol checkpoints/scans,
 * incidents (create/list/status).
 * Permission: `operations.manage` (sites also accept `enterprise.manage`;
 * attendance/field-alerts/patrol list also accept `attendance.manage`;
 * incidents require `incidents.manage`).
 * Keep `/operations` as guard readiness; this module is BOM/Field site ops.
 */
import { authHeaders, clearSession, getRefreshToken, setTokens } from '@pssms/auth';
import { listBranches, listGuards, type Branch, type Guard } from './admin';

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
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const doFetch = (access?: string | null) =>
    fetch(`${coreUrl()}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(access ?? token),
        ...(rest.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const next = await tryRefresh();
    if (next) res = await doFetch(next);
    else {
      clearSession();
      throw new Error('Session expired');
    }
  }
  return parseEnvelope<T>(res);
}

export type { Branch, Guard };
export { listBranches, listGuards };

export type Site = {
  id: string;
  organizationId: string;
  branchId: string;
  customerId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
};

export type Deployment = {
  id: string;
  guardId: string;
  siteId: string;
  /** Required on create (G2); null on legacy seed rows until backfilled. */
  contractId?: string | null;
  contractNumber?: string | null;
  customerId?: string | null;
  status: string;
  startDate: string;
  endDate?: string | null;
};

export type Shift = {
  id: string;
  siteId: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
};

export type FieldAlert = {
  id: string;
  organizationId: string;
  siteId: string;
  guardId?: string | null;
  alertType: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  escalationStage: string;
  escalatedAt?: string | null;
  escalatedBy?: string | null;
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  guardId: string;
  siteId: string;
  shiftId?: string | null;
  clockInAt: string;
  clockOutAt?: string | null;
  clockInMethod: string;
  clockOutMethod?: string | null;
  geofenceWarning: boolean;
  isLate: boolean;
  lateMinutes: number;
  isOvertime: boolean;
  overtimeMinutes: number;
  supervisorApproved: boolean;
  remarks?: string | null;
  syncStatus: string;
};

export type PendingAlertness = {
  id: string;
  organizationId: string;
  guardId: string;
  siteId: string;
  shiftId?: string | null;
  scheduledAt: string;
  status: string;
  referenceNumber?: string | null;
  /** Module 10-A — due passed; confirm will record LATE until mark-missed */
  pastDue?: boolean;
};

/** Module 10-C — completed alertness audit roster */
export type AlertnessHistoryRow = {
  id: string;
  organizationId: string;
  guardId: string;
  siteId: string;
  shiftId?: string | null;
  scheduledAt: string;
  confirmedAt?: string | null;
  status: string;
  method?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  referenceNumber?: string | null;
  supervisorRemarks?: string | null;
  employeeNumber?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

export const listAlertnessHistory = (
  params?: {
    guardId?: string;
    siteId?: string;
    status?: string;
    from?: string;
    to?: string;
    take?: number;
  },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.guardId) sp.set('guardId', params.guardId);
  if (params?.siteId) sp.set('siteId', params.siteId);
  if (params?.status) sp.set('status', params.status);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  if (params?.take !== undefined) sp.set('take', String(params.take));
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<AlertnessHistoryRow[]>(
    `/api/v1/attendance/alertness/history${q}`,
    { token },
  );
};

export const listSites = (token?: string) =>
  coreFetch<Site[]>('/api/v1/enterprise/sites', { token });

export const createSite = (
  body: {
    branchId: string;
    code: string;
    name: string;
    customerId?: string;
    address?: string;
  },
  token?: string,
) =>
  coreFetch<Site>('/api/v1/enterprise/sites', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listDeployments = (token?: string) =>
  coreFetch<Deployment[]>('/api/v1/operations/deployments', { token });

export const createDeployment = (
  body: {
    guardId: string;
    siteId: string;
    /** Billable contract covering the site (ContractSite). */
    contractId: string;
    startDate: string;
    endDate?: string;
  },
  token?: string,
) =>
  coreFetch<Deployment>('/api/v1/operations/deployments', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const endDeployment = (id: string, token?: string) =>
  coreFetch<Deployment>(`/api/v1/operations/deployments/${id}/end`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const listShifts = (siteId?: string, token?: string) => {
  const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return coreFetch<Shift[]>(`/api/v1/operations/shifts${q}`, { token });
};

export const createShift = (
  body: {
    siteId: string;
    name: string;
    startAt: string;
    endAt: string;
    instructions?: string;
    guardIds: string[];
    supervisorId?: string;
  },
  token?: string,
) =>
  coreFetch<Shift>('/api/v1/operations/shifts', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listFieldAlerts = (
  params?: {
    siteId?: string;
    acknowledged?: boolean;
    escalationStage?: string;
  },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.siteId) sp.set('siteId', params.siteId);
  if (typeof params?.acknowledged === 'boolean') {
    sp.set('acknowledged', String(params.acknowledged));
  }
  if (params?.escalationStage) {
    sp.set('escalationStage', params.escalationStage);
  }
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<FieldAlert[]>(`/api/v1/attendance/field-alerts${q}`, {
    token,
  });
};

export const escalateFieldAlert = (id: string, token?: string) =>
  coreFetch<FieldAlert>(`/api/v1/attendance/field-alerts/${id}/escalate`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const acknowledgeFieldAlert = (id: string, token?: string) =>
  coreFetch<FieldAlert>(`/api/v1/attendance/field-alerts/${id}/acknowledge`, {
    method: 'POST',
    body: '{}',
    token,
  });

/** Org-scoped guard attendance — requires operations.manage or attendance.manage. */
export const listAttendance = (
  params?: {
    siteId?: string;
    supervisorApproved?: boolean;
    from?: string;
    to?: string;
  },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.siteId) sp.set('siteId', params.siteId);
  if (typeof params?.supervisorApproved === 'boolean') {
    sp.set('supervisorApproved', String(params.supervisorApproved));
  }
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<AttendanceRecord[]>(`/api/v1/attendance${q}`, { token });
};

/** POST /attendance/:id/approve — supervisor verify; guard ≠ approver (SoD). */
export const approveAttendance = (id: string, token?: string) =>
  coreFetch<AttendanceRecord>(`/api/v1/attendance/${id}/approve`, {
    method: 'POST',
    body: '{}',
    token,
  });

export type SupervisorClockInResult = {
  id: string;
  guardId: string;
  siteId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  syncStatus: string;
  geofenceVerified?: boolean;
  alertnessChecksScheduled?: number;
};

/** POST /attendance/supervisor-clock-in — manual punch when guard app fails. */
export const supervisorClockIn = (
  body: {
    guardId: string;
    siteId: string;
    shiftId?: string;
    remarks?: string;
    gps?: { latitude: number; longitude: number; gpsTime?: string };
  },
  token?: string,
) =>
  coreFetch<SupervisorClockInResult>(
    '/api/v1/attendance/supervisor-clock-in',
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/**
 * Pending alertness checks (SCHEDULED). Non-guard supervisors see org-wide;
 * guards without guardId see only their own (mobile self-service).
 */
export const listPendingAlertness = (
  params?: { guardId?: string },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.guardId) sp.set('guardId', params.guardId);
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<PendingAlertness[]>(
    `/api/v1/attendance/alertness/pending${q}`,
    { token },
  );
};

export const scheduleAlertness = (
  body: {
    guardId: string;
    siteId: string;
    shiftId?: string;
    scheduledAt: string;
  },
  token?: string,
) =>
  coreFetch<PendingAlertness>('/api/v1/attendance/alertness/schedule', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const markAlertnessMissed = (
  id: string,
  options?: { supervisorRemarks?: string; token?: string },
) =>
  coreFetch<PendingAlertness & { supervisorRemarks?: string | null }>(
    `/api/v1/attendance/alertness/${id}/missed`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...(options?.supervisorRemarks?.trim()
          ? { supervisorRemarks: options.supervisorRemarks.trim() }
          : {}),
      }),
      token: options?.token,
    },
  );

export type AlertnessScanMissedResult = {
  markedMissed: number;
  referenceNumbers: string[];
};

export const scanMissedAlertness = (
  graceMinutes = 0,
  token?: string,
) => {
  const q =
    graceMinutes > 0
      ? `?graceMinutes=${encodeURIComponent(String(graceMinutes))}`
      : '';
  return coreFetch<AlertnessScanMissedResult>(
    `/api/v1/attendance/alertness/scan-missed${q}`,
    { method: 'POST', token },
  );
};

/** Append-only electronic occurrence book — current versions only. */
export type OccurrenceEntry = {
  id: string;
  siteId: string;
  siteCode?: string;
  siteName?: string;
  category: string;
  description: string;
  version: number;
  isCurrent: boolean;
  correctionReason?: string | null;
  officerId?: string | null;
  approvedBy?: string | null;
  recordedAt: string;
  createdAt: string;
};

/** One version in occurrence lineage (GET …/history). */
export type OccurrenceHistoryVersion = {
  id: string;
  version: number;
  isCurrent: boolean;
  category: string;
  description: string;
  correctionReason?: string | null;
  officerId?: string | null;
  recordedAt: string;
  createdAt: string;
  parentEntryId?: string | null;
  approvedBy?: string | null;
};

export const listOccurrenceEntries = (
  params?: { siteId?: string },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.siteId) sp.set('siteId', params.siteId);
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<OccurrenceEntry[]>(`/api/v1/occurrence-book${q}`, {
    token,
  });
};

export const createOccurrenceEntry = (
  body: {
    siteId: string;
    category: string;
    description: string;
    recordedAt: string;
  },
  token?: string,
) =>
  coreFetch<OccurrenceEntry>('/api/v1/occurrence-book', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Append-only correction — original marked non-current; new version created. */
export const correctOccurrenceEntry = (
  id: string,
  body: { reason: string; description: string; category?: string },
  token?: string,
) =>
  coreFetch<OccurrenceEntry>(`/api/v1/occurrence-book/${id}/correct`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Second-person approve current entry (recorder ≠ approver). */
export const approveOccurrenceEntry = (id: string, token?: string) =>
  coreFetch<OccurrenceEntry>(`/api/v1/occurrence-book/${id}/approve`, {
    method: 'POST',
    token,
  });

/** Full version lineage (accepts current or superseded id). */
export const getOccurrenceHistory = (id: string, token?: string) =>
  coreFetch<OccurrenceHistoryVersion[]>(
    `/api/v1/occurrence-book/${id}/history`,
    { token },
  );

/** Patrol checkpoint (QR/NFC/GPS) — create/list requires operations.manage. */
export type Checkpoint = {
  id: string;
  siteId: string;
  siteCode?: string;
  siteName?: string;
  code: string;
  name: string;
  zone?: string | null;
  qrCode?: string | null;
  nfcTagId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  createdAt?: string;
};

/** Recent patrol scan — list requires operations.manage or attendance.manage. */
export type PatrolScan = {
  id: string;
  guardId: string;
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  checkpointId: string;
  checkpointCode?: string;
  checkpointName?: string;
  checkpointZone?: string | null;
  scannedAt: string;
  method: string;
  latitude?: number | null;
  longitude?: number | null;
  syncStatus?: string;
  checkpoint?: { code: string; name: string; zone?: string | null };
};

export const listCheckpoints = (siteId?: string, token?: string) => {
  const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return coreFetch<Checkpoint[]>(`/api/v1/operations/checkpoints${q}`, {
    token,
  });
};

export const createCheckpoint = (
  body: {
    siteId: string;
    code: string;
    name: string;
    zone?: string;
    qrCode?: string;
    nfcTagId?: string;
    latitude?: number;
    longitude?: number;
  },
  token?: string,
) =>
  coreFetch<Checkpoint>('/api/v1/operations/checkpoints', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listPatrolScans = (siteId?: string, token?: string) => {
  const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return coreFetch<PatrolScan[]>(`/api/v1/attendance/patrols${q}`, { token });
};

export type PatrolRouteCoverage = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type PatrolSlaStatus = 'OK' | 'ON_TRACK' | 'LATE' | 'MISSED';

export type PatrolRoute = {
  id: string;
  siteId: string;
  siteCode?: string;
  siteName?: string;
  name: string;
  checkpointIds: string[];
  checkpoints: { id: string; code: string; name: string }[];
  checkpointCount: number;
  scannedToday: number;
  coverageStatus: PatrolRouteCoverage;
  slaStatus: PatrolSlaStatus;
  dueMinutesFromMidnight: number;
  dueAt: string;
  openPatrolAlertId?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type PatrolScanMissedResult = {
  markedMissed: number;
  routeIds: string[];
  routeNames: string[];
};

export const listPatrolRoutes = (siteId?: string, token?: string) => {
  const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return coreFetch<PatrolRoute[]>(`/api/v1/operations/patrol-routes${q}`, {
    token,
  });
};

export const createPatrolRoute = (
  body: {
    siteId: string;
    name: string;
    checkpointIds: string[];
    dueMinutesFromMidnight?: number;
  },
  token?: string,
) =>
  coreFetch<PatrolRoute>('/api/v1/operations/patrol-routes', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Mark past-due incomplete routes MISSED + FieldAlert PATROL_MISSED. */
export const scanMissedPatrolRoutes = (
  graceMinutes = 0,
  token?: string,
) => {
  const q =
    graceMinutes > 0
      ? `?graceMinutes=${encodeURIComponent(String(graceMinutes))}`
      : '';
  return coreFetch<PatrolScanMissedResult>(
    `/api/v1/operations/patrol-routes/scan-missed${q}`,
    { method: 'POST', token },
  );
};

export const markPatrolRouteMissed = (id: string, token?: string) =>
  coreFetch<PatrolRoute>(`/api/v1/operations/patrol-routes/${id}/mark-missed`, {
    method: 'POST',
    token,
  });

/** Incident — create/list/status require `incidents.manage`. */
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED';

export type Incident = {
  id: string;
  incidentNumber: string;
  siteId: string;
  siteCode?: string;
  siteName?: string;
  category: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  reporterId: string;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  allowedNextStatuses?: IncidentStatus[];
  blockedReason?: string;
  requiredRoleHint?: string;
};

export const listIncidents = (
  params?: { siteId?: string },
  token?: string,
) => {
  const sp = new URLSearchParams();
  if (params?.siteId) sp.set('siteId', params.siteId);
  const q = sp.toString() ? `?${sp}` : '';
  return coreFetch<Incident[]>(`/api/v1/incidents${q}`, { token });
};

export const createIncident = (
  body: {
    siteId: string;
    category: string;
    title: string;
    description: string;
    severity: IncidentSeverity;
  },
  token?: string,
) =>
  coreFetch<Incident>('/api/v1/incidents', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateIncidentStatus = (
  id: string,
  body: { status: IncidentStatus; assignedTo?: string },
  token?: string,
) =>
  coreFetch<Incident>(`/api/v1/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

