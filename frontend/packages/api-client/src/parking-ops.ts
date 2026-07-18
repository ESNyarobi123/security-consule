import { getParkingToken, getToken, parkingAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

/** Prefer parking portal cookie; fall back to admin token (CCTV / shared ANPR list). */
function opsAuthHeaders(token?: string | null): HeadersInit {
  if (token) return { Authorization: `Bearer ${token}` };
  const parking = getParkingToken();
  if (parking) return parkingAuthHeaders(parking);
  const admin = getToken();
  return admin ? { Authorization: `Bearer ${admin}` } : {};
}

async function parkingOpsFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...opsAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

export type ParkingOpsVehicle = {
  id: string;
  organizationId: string;
  customerId?: string | null;
  plateNumber: string;
  vehicleType: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  ownerName?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ParkingOpsPermit = {
  id: string;
  organizationId: string;
  vehicleId: string;
  siteId: string;
  permitNumber: string;
  permitType: string;
  status: string;
  validFrom: string;
  validUntil: string;
  createdAt: string;
};

export type ParkingOpsEntry = {
  id: string;
  organizationId: string;
  siteId: string;
  gateId?: string | null;
  vehicleId?: string | null;
  plateNumber: string;
  direction: string;
  permitId?: string | null;
  decision: string;
  recordedBy?: string | null;
  recordedAt: string;
  createdAt: string;
};

export type ParkingOpsViolation = {
  id: string;
  organizationId: string;
  siteId: string;
  plateNumber: string;
  vehicleId?: string | null;
  violationType: string;
  description?: string | null;
  recordedAt: string;
  createdAt: string;
};

export type AnprResult = {
  id: string;
  organizationId?: string;
  siteId: string;
  gateId?: string | null;
  plateNumber: string;
  confidence?: number | null;
  cameraId?: string | null;
  imageUrl?: string | null;
  decision?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  denyReason?: string | null;
  capturedAt: string;
  createdAt?: string;
};

export type ParkingBlacklistEntry = {
  id: string;
  organizationId: string;
  plateNumber: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string | null;
};

/** Parking portal login → core-api POST /auth/login */
export async function parkingLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

/** GET /parking/vehicles */
export const listVehicles = (token?: string) =>
  parkingOpsFetch<ParkingOpsVehicle[]>('/api/v1/parking/vehicles', { token });

/** GET /parking/permits?status= */
export const listPermits = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return parkingOpsFetch<ParkingOpsPermit[]>(`/api/v1/parking/permits${q}`, {
    token,
  });
};

/** POST /parking/permits/:id/approve */
export const approvePermit = (id: string, token?: string) =>
  parkingOpsFetch<ParkingOpsPermit>(`/api/v1/parking/permits/${id}/approve`, {
    method: 'POST',
    token,
  });

/** GET /parking/entries */
export const listEntries = (token?: string) =>
  parkingOpsFetch<ParkingOpsEntry[]>('/api/v1/parking/entries', { token });

/** GET /parking/violations */
export const listViolations = (token?: string) =>
  parkingOpsFetch<ParkingOpsViolation[]>('/api/v1/parking/violations', {
    token,
  });

/** GET /parking/anpr-results?decision= — also accepts bare token for admin CCTV. */
export const listAnprResults = (
  decisionOrOpts?: string | { decision?: string; token?: string },
  token?: string,
) => {
  if (typeof decisionOrOpts === 'object' && decisionOrOpts !== null) {
    const q = decisionOrOpts.decision
      ? `?decision=${encodeURIComponent(decisionOrOpts.decision)}`
      : '';
    return parkingOpsFetch<AnprResult[]>(`/api/v1/parking/anpr-results${q}`, {
      token: decisionOrOpts.token ?? token,
    });
  }
  const decision =
    decisionOrOpts &&
    ['PENDING', 'ALLOW', 'DENY'].includes(decisionOrOpts.toUpperCase())
      ? decisionOrOpts
      : undefined;
  const resolvedToken = decision ? token : decisionOrOpts ?? token;
  const q = decision ? `?decision=${encodeURIComponent(decision)}` : '';
  return parkingOpsFetch<AnprResult[]>(`/api/v1/parking/anpr-results${q}`, {
    token: resolvedToken,
  });
};

/** PATCH /parking/anpr-results/:id/decide */
export const decideAnpr = (
  id: string,
  body: { decision: 'ALLOW' | 'DENY'; denyReason?: string },
  token?: string,
) =>
  parkingOpsFetch<AnprResult>(`/api/v1/parking/anpr-results/${id}/decide`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/anpr-results — optional for demos */
export const ingestAnpr = (
  body: {
    siteId: string;
    gateId?: string;
    plateNumber: string;
    confidence?: number;
    cameraId?: string;
    imageUrl?: string;
    capturedAt: string;
    rawPayload?: Record<string, unknown>;
  },
  token?: string,
) =>
  parkingOpsFetch<AnprResult>('/api/v1/parking/anpr-results', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** GET /parking/blacklist */
export const listBlacklist = (token?: string) =>
  parkingOpsFetch<ParkingBlacklistEntry[]>('/api/v1/parking/blacklist', {
    token,
  });

/** POST /parking/blacklist */
export const addBlacklist = (
  body: { plateNumber: string; reason: string },
  token?: string,
) =>
  parkingOpsFetch<ParkingBlacklistEntry>('/api/v1/parking/blacklist', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** PATCH /parking/blacklist/:id/deactivate */
export const deactivateBlacklist = (id: string, token?: string) =>
  parkingOpsFetch<ParkingBlacklistEntry>(
    `/api/v1/parking/blacklist/${id}/deactivate`,
    { method: 'PATCH', token },
  );
