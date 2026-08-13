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

/** Module 13-I — parking category (who the vehicle is for) */
export type ParkingCategory =
  | 'CUSTOMER'
  | 'CUSTOMER_EMPLOYEE'
  | 'VISITOR'
  | 'COMPANY'
  | 'PATROL'
  | 'SUPPLIER'
  | 'CONTRACTOR'
  | 'EMERGENCY'
  | 'TEMPORARY';

export type ParkingOpsVehicle = {
  id: string;
  organizationId: string;
  customerId?: string | null;
  plateNumber: string;
  vehicleType: string;
  /** Module 13-I */
  parkingCategory?: ParkingCategory | string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  /** Module 13-A */
  rfidTagRef?: string | null;
  isActive: boolean;
  createdAt: string;
};

/** Module 13-E/I — ops register vehicle */
export type CreateParkingVehicleBody = {
  customerId?: string;
  plateNumber: string;
  vehicleType?: string;
  parkingCategory?: ParkingCategory;
  make?: string;
  model?: string;
  color?: string;
  ownerName?: string;
  ownerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  rfidTagRef?: string;
};

export type UpdateParkingVehicleBody = {
  vehicleType?: string;
  parkingCategory?: ParkingCategory;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  rfidTagRef?: string | null;
  isActive?: boolean;
};

/** Thin customer picker for ops vehicle register (GET /customers is auth-only). */
export type ParkingCustomerOption = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

export type ParkingBillingPeriod = 'ONE_TIME' | 'DAILY' | 'MONTHLY';

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
  /** Module 13-B / 13-O */
  feeAmount?: number | null;
  currency?: string | null;
  billingPeriod?: ParkingBillingPeriod | string;
  unitRate?: number | null;
  quantity?: number | null;
  discountAmount?: number | null;
  penaltyAmount?: number | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  billedAt?: string | null;
  plateNumber?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  /** Module 13-H */
  visitorAppointmentId?: string | null;
  visitorReferenceNumber?: string | null;
  visitorName?: string | null;
};

export type CreateParkingPermitBody = {
  vehicleId: string;
  siteId: string;
  permitType:
    | 'EMPLOYEE'
    | 'VISITOR'
    | 'CONTRACTOR'
    | 'SUPPLIER'
    | 'RESERVED';
  permitNumber?: string;
  validFrom?: string;
  validUntil?: string;
  feeAmount?: number;
  currency?: string;
  billingPeriod?: ParkingBillingPeriod;
  unitRate?: number;
  quantity?: number;
  discountAmount?: number;
  penaltyAmount?: number;
  visitorAppointmentId?: string;
};

export type UpdateParkingPermitBody = {
  feeAmount?: number | null;
  currency?: string;
  billingPeriod?: ParkingBillingPeriod;
  unitRate?: number | null;
  quantity?: number | null;
  discountAmount?: number | null;
  penaltyAmount?: number | null;
};

export type ParkingVisitorAppointmentOption = {
  id: string;
  referenceNumber: string;
  visitorName: string;
  siteId: string;
  customerId: string;
  status: string;
  vehiclePlate?: string | null;
  validFrom: string;
  validUntil: string;
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
  siteCode?: string | null;
  siteName?: string | null;
  gateCode?: string | null;
  gateName?: string | null;
  /** Module 13-K */
  fieldAlertId?: string | null;
  fieldAlertIds?: string[];
  /** Module 13-L */
  driverName?: string | null;
  driverIdRef?: string | null;
  verificationMethod?: string;
  purposeOfVisit?: string | null;
  visitorAppointmentId?: string | null;
  visitorReferenceNumber?: string | null;
  visitorName?: string | null;
  parkingSpaceId?: string | null;
  parkingSpaceCode?: string | null;
  pairedEntryId?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  entryGateCode?: string | null;
  exitGateCode?: string | null;
  recordedByName?: string | null;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
};

export type ParkingVerificationMethod =
  | 'MANUAL'
  | 'RFID'
  | 'ANPR'
  | 'QR'
  | 'OTHER';

export type CreateParkingEntryBody = {
  siteId: string;
  gateId?: string;
  plateNumber?: string;
  rfidTagRef?: string;
  direction: 'ENTRY' | 'EXIT';
  /** Omit for auto (blacklist + permit rules on ENTRY). */
  decision?: 'ALLOW' | 'DENY' | 'PENDING';
  clientEventId?: string;
  recordedAt?: string;
  driverName?: string;
  driverIdRef?: string;
  verificationMethod?: ParkingVerificationMethod;
  purposeOfVisit?: string;
  visitorAppointmentId?: string;
  parkingSpaceId?: string;
};

export type ParkingSiteOption = {
  id: string;
  code: string;
  name: string;
  gates: Array<{ id: string; code: string; name: string }>;
};

export type ParkingOpsViolation = {
  id: string;
  organizationId: string;
  siteId: string;
  plateNumber: string;
  vehicleId?: string | null;
  violationType: string;
  description?: string | null;
  officerRemarks?: string | null;
  correctiveAction?: string | null;
  correctiveActionAt?: string | null;
  correctiveActionBy?: string | null;
  submittedForClosureAt?: string | null;
  submittedForClosureBy?: string | null;
  approvalNotes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  closureNotes?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  status: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  /** Module 13-P */
  fineAmount?: number | null;
  currency?: string | null;
  discountAmount?: number | null;
  netFineAmount?: number | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  billedAt?: string | null;
  recordedAt: string;
  createdAt: string;
  createdBy?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

export type ParkingViolationType =
  | 'NO_PERMIT'
  | 'UNAUTHORIZED'
  | 'EXPIRED_PERMIT'
  | 'WRONG_ZONE'
  | 'RESTRICTED_AREA'
  | 'EMERGENCY_ROUTE_BLOCKED'
  | 'DOUBLE_PARKING'
  | 'OVERSTAY'
  | 'ABANDONED_VEHICLE'
  | 'UNSAFE_PARKING'
  | 'BLACKLISTED';

export type CreateParkingViolationBody = {
  siteId: string;
  plateNumber: string;
  vehicleId?: string;
  violationType: ParkingViolationType;
  description?: string;
  officerRemarks?: string;
  fineAmount?: number;
  currency?: string;
  discountAmount?: number;
};

export type UpdateParkingViolationBody = {
  officerRemarks?: string;
  correctiveAction?: string;
  fineAmount?: number | null;
  currency?: string;
  discountAmount?: number | null;
};

export type ApproveParkingViolationClosureBody = {
  approvalNotes?: string;
  closureNotes?: string;
};

export type ResolveParkingViolationBody = {
  resolutionNotes?: string;
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
  siteCode?: string | null;
  siteName?: string | null;
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

/** POST /parking/vehicles — Module 13-E ops register */
export const createVehicle = (
  body: CreateParkingVehicleBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsVehicle>('/api/v1/parking/vehicles', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** PATCH /parking/vehicles/:id — Module 13-A/E RFID + profile fields */
export const updateVehicle = (
  id: string,
  body: UpdateParkingVehicleBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsVehicle>(`/api/v1/parking/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** GET /parking/customer-options — thin id/code/name picker (Module 13-E) */
export const listParkingCustomerOptions = (token?: string) =>
  parkingOpsFetch<ParkingCustomerOption[]>(
    '/api/v1/parking/customer-options',
    { token },
  );

/** GET /parking/site-options — thin sites + gates (Module 13-F) */
export const listParkingSiteOptions = (token?: string) =>
  parkingOpsFetch<ParkingSiteOption[]>('/api/v1/parking/site-options', {
    token,
  });

/** GET /parking/visitor-appointment-options — Module 13-H */
export const listParkingVisitorAppointmentOptions = (token?: string) =>
  parkingOpsFetch<ParkingVisitorAppointmentOption[]>(
    '/api/v1/parking/visitor-appointment-options',
    { token },
  );

/** GET /parking/permits?status= */
export const listPermits = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return parkingOpsFetch<ParkingOpsPermit[]>(`/api/v1/parking/permits${q}`, {
    token,
  });
};

/** POST /parking/permits — Module 13-H ops issue (+ portal 13-D) */
export const createPermit = (
  body: CreateParkingPermitBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsPermit>('/api/v1/parking/permits', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** PATCH /parking/permits/:id — Module 13-B fee / currency */
export const updatePermit = (
  id: string,
  body: UpdateParkingPermitBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsPermit>(`/api/v1/parking/permits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/permits/:id/bill — Module 13-B DRAFT invoice */
/** POST /parking/permits/:id/bill — Module 13-O (?send=1 for electronic send) */
export const billPermit = (
  id: string,
  opts?: { send?: boolean; token?: string },
) => {
  const q = opts?.send ? '?send=1' : '';
  return parkingOpsFetch<ParkingOpsPermit>(
    `/api/v1/parking/permits/${id}/bill${q}`,
    {
      method: 'POST',
      token: opts?.token,
    },
  );
};

/** POST /parking/permits/:id/approve */
export const approvePermit = (id: string, token?: string) =>
  parkingOpsFetch<ParkingOpsPermit>(`/api/v1/parking/permits/${id}/approve`, {
    method: 'POST',
    token,
  });

/** POST /parking/permits/:id/reject */
export const rejectPermit = (id: string, token?: string) =>
  parkingOpsFetch<ParkingOpsPermit>(`/api/v1/parking/permits/${id}/reject`, {
    method: 'POST',
    token,
  });

/** GET /parking/entries */
export const listEntries = (token?: string) =>
  parkingOpsFetch<ParkingOpsEntry[]>('/api/v1/parking/entries', { token });

/** POST /parking/entries — Module 13-F manual gate ENTRY/EXIT */
export const createParkingEntry = (
  body: CreateParkingEntryBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsEntry>('/api/v1/parking/entries', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** GET /parking/violations?status= */
export const listViolations = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return parkingOpsFetch<ParkingOpsViolation[]>(
    `/api/v1/parking/violations${q}`,
    { token },
  );
};

/** POST /parking/violations — Module 13-G */
export const createParkingViolation = (
  body: CreateParkingViolationBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsViolation>('/api/v1/parking/violations', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/violations/:id/resolve — Module 13-N alias for approve-closure */
export const resolveParkingViolation = (
  id: string,
  body: ResolveParkingViolationBody = {},
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsViolation>(
    `/api/v1/parking/violations/${id}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** PATCH /parking/violations/:id — Module 13-N */
export const updateParkingViolation = (
  id: string,
  body: UpdateParkingViolationBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsViolation>(`/api/v1/parking/violations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/violations/:id/submit-closure — Module 13-N */
export const submitParkingViolationClosure = (id: string, token?: string) =>
  parkingOpsFetch<ParkingOpsViolation>(
    `/api/v1/parking/violations/${id}/submit-closure`,
    { method: 'POST', token },
  );

/** POST /parking/violations/:id/approve-closure — Module 13-N SoD */
export const approveParkingViolationClosure = (
  id: string,
  body: ApproveParkingViolationClosureBody = {},
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsViolation>(
    `/api/v1/parking/violations/${id}/approve-closure`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** POST /parking/violations/:id/bill?send= — Module 13-P */
export const billParkingViolation = (
  id: string,
  opts?: { send?: boolean; token?: string },
) => {
  const q = opts?.send ? '?send=1' : '';
  return parkingOpsFetch<ParkingOpsViolation>(
    `/api/v1/parking/violations/${id}/bill${q}`,
    { method: 'POST', token: opts?.token },
  );
};

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

/** Module 13-J — bay purpose */
export type ParkingSpaceType =
  | 'EMPLOYEE'
  | 'VISITOR'
  | 'VIP'
  | 'CONTRACTOR'
  | 'SUPPLIER'
  | 'FLEET'
  | 'RESERVED'
  | 'DISABLED'
  | 'TEMPORARY'
  | 'OVERFLOW';

export type ParkingSpaceStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'OUT_OF_SERVICE';

export type ParkingAllocationMode = 'MANUAL' | 'AUTO';

export type ParkingOpsSpace = {
  id: string;
  organizationId: string;
  siteId: string;
  customerId?: string | null;
  code: string;
  label?: string | null;
  spaceType: ParkingSpaceType | string;
  status: ParkingSpaceStatus | string;
  allocationMode: ParkingAllocationMode | string;
  vehicleId?: string | null;
  permitId?: string | null;
  allocatedAt?: string | null;
  allocatedBy?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  siteCode?: string | null;
  siteName?: string | null;
  plateNumber?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
};

export type CreateParkingSpaceBody = {
  siteId: string;
  code: string;
  spaceType: ParkingSpaceType;
  customerId?: string;
  label?: string;
  allocationMode?: ParkingAllocationMode;
  notes?: string;
};

export type UpdateParkingSpaceBody = {
  spaceType?: ParkingSpaceType;
  allocationMode?: ParkingAllocationMode;
  status?: ParkingSpaceStatus;
  label?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type AllocateParkingSpaceBody = {
  mode: ParkingAllocationMode;
  vehicleId: string;
  siteId: string;
  spaceId?: string;
  spaceType?: ParkingSpaceType;
  permitId?: string;
};

/** GET /parking/spaces */
export const listParkingSpaces = (
  params?: {
    siteId?: string;
    spaceType?: ParkingSpaceType;
    status?: ParkingSpaceStatus;
    customerId?: string;
  },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (params?.siteId) q.set('siteId', params.siteId);
  if (params?.spaceType) q.set('spaceType', params.spaceType);
  if (params?.status) q.set('status', params.status);
  if (params?.customerId) q.set('customerId', params.customerId);
  const qs = q.toString();
  return parkingOpsFetch<ParkingOpsSpace[]>(
    `/api/v1/parking/spaces${qs ? `?${qs}` : ''}`,
    { token },
  );
};

/** POST /parking/spaces */
export const createParkingSpace = (
  body: CreateParkingSpaceBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsSpace>('/api/v1/parking/spaces', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** PATCH /parking/spaces/:id */
export const updateParkingSpace = (
  id: string,
  body: UpdateParkingSpaceBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsSpace>(`/api/v1/parking/spaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/spaces/allocate */
export const allocateParkingSpace = (
  body: AllocateParkingSpaceBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsSpace>('/api/v1/parking/spaces/allocate', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** POST /parking/spaces/:id/release */
export const releaseParkingSpace = (id: string, token?: string) =>
  parkingOpsFetch<ParkingOpsSpace>(`/api/v1/parking/spaces/${id}/release`, {
    method: 'POST',
    token,
  });

/** Module 13-M — parking patrol observation types */
export type ParkingPatrolObservationType =
  | 'IRREGULARITY'
  | 'SECURITY_OBSERVATION'
  | 'ACCIDENT'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DAMAGE'
  | 'ILLEGAL_PARKING'
  | 'ABANDONED_VEHICLE'
  | 'OTHER';

export type ParkingOpsPatrolObservation = {
  id: string;
  organizationId: string;
  siteId: string;
  guardId: string;
  inspectedAt: string;
  parkingArea: string;
  observationType: ParkingPatrolObservationType | string;
  plateNumber?: string | null;
  vehicleId?: string | null;
  parkingSpaceId?: string | null;
  notes?: string | null;
  severity: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  fieldAlertId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  guardEmployeeNumber?: string | null;
  parkingSpaceCode?: string | null;
};

export type CreateParkingPatrolObservationBody = {
  siteId: string;
  parkingArea: string;
  observationType: ParkingPatrolObservationType;
  plateNumber?: string;
  vehicleId?: string;
  parkingSpaceId?: string;
  notes?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  inspectedAt?: string;
  guardId?: string;
  latitude?: number;
  longitude?: number;
  clientEventId?: string;
};

/** GET /parking/patrol-observations */
export const listParkingPatrolObservations = (
  params?: {
    siteId?: string;
    observationType?: ParkingPatrolObservationType;
    guardId?: string;
  },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (params?.siteId) q.set('siteId', params.siteId);
  if (params?.observationType) q.set('observationType', params.observationType);
  if (params?.guardId) q.set('guardId', params.guardId);
  const qs = q.toString();
  return parkingOpsFetch<ParkingOpsPatrolObservation[]>(
    `/api/v1/parking/patrol-observations${qs ? `?${qs}` : ''}`,
    { token },
  );
};

/** POST /parking/patrol-observations */
export const createParkingPatrolObservation = (
  body: CreateParkingPatrolObservationBody,
  token?: string,
) =>
  parkingOpsFetch<ParkingOpsPatrolObservation>(
    '/api/v1/parking/patrol-observations',
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** Module 13-Q — parking reports pack */
export type ParkingOpsReport = {
  organizationId: string;
  period: { from: string; to: string };
  siteId?: string | null;
  summary: {
    sitesInScope: number;
    registeredVehicles: number;
    activePermits: number;
    pendingPermits: number;
  };
  entriesExits: {
    entries: number;
    exits: number;
    allowed: number;
    denied: number;
    openVisits: number;
  };
  occupancy: {
    totalSpaces: number;
    available: number;
    occupied: number;
    reserved: number;
    outOfService: number;
    utilizationPercent: number;
  };
  visitorParking: {
    activeVisitorPermits: number;
    visitorPermitsIssuedInPeriod: number;
    visitorEntries: number;
    activeContractorPermits: number;
  };
  employeeParking: {
    activeEmployeePermits: number;
    employeePermitsIssuedInPeriod: number;
    customerEmployeeVehicles: number;
    fleetVehicles: number;
  };
  violations: {
    recordedInPeriod: number;
    openNow: number;
    closedInPeriod: number;
    byType: Record<string, number>;
    finesBilledInPeriod: number;
    finesRevenueBilled: number;
  };
  blacklist: { activePlates: number; addedInPeriod: number };
  patrols: {
    observationsInPeriod: number;
    highSeverity: number;
    accidents: number;
    suspiciousActivity: number;
    illegalParking: number;
    byType: Record<string, number>;
  };
  revenue: {
    currency: string;
    permitInvoicesBilledInPeriod: number;
    permitRevenueBilled: number;
    violationInvoicesBilledInPeriod: number;
    violationRevenueBilled: number;
    totalBilledInPeriod: number;
  };
  securityIncidents: {
    incidentsInPeriod: number;
    incidentsOpenNow: number;
    patrolAccidentsInPeriod: number;
    patrolSuspiciousInPeriod: number;
  };
  bySite: Array<{
    siteId: string;
    siteCode: string;
    siteName: string;
    entries: number;
    exits: number;
    denied: number;
    activePermits: number;
    violations: number;
    spacesTotal: number;
    spacesOccupied: number;
    utilizationPercent: number;
  }>;
  generatedAt: string;
  notes: string[];
};

/** GET /parking/reports?from=&to=&siteId= */
export const getParkingReport = (
  params?: { from?: string; to?: string; siteId?: string },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.siteId) q.set('siteId', params.siteId);
  const qs = q.toString();
  return parkingOpsFetch<ParkingOpsReport>(
    `/api/v1/parking/reports${qs ? `?${qs}` : ''}`,
    { token },
  );
};
