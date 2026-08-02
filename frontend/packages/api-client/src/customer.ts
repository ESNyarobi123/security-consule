import {
  clearCustomerSession,
  customerAuthHeaders,
  getCustomerRefreshToken,
  setCustomerTokens,
} from '@pssms/auth';
import type { LoginResult } from './index';
import type {
  Contract,
  Invoice,
  VisitorAppointment,
} from './admin';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

function errorMessageFromBody(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string | string[] };
      message?: string;
    };
    const msg = json.error?.message ?? json.message;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  } catch {
    /* not JSON */
  }
  return text.trim() || fallback;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromBody(text, `Request failed (${res.status})`));
  }
  if (!text) throw new Error('Empty response from API');
  const json = JSON.parse(text) as ApiEnvelope<T>;
  if (json.success === false) {
    throw new Error(
      errorMessageFromBody(text, 'Request failed'),
    );
  }
  return json.data;
}

/** Single-flight refresh so concurrent 401s share one refresh call. */
let customerRefreshInFlight: Promise<string | null> | null = null;

async function tryCustomerRefresh(): Promise<string | null> {
  const rt = getCustomerRefreshToken();
  if (!rt) return null;
  if (!customerRefreshInFlight) {
    customerRefreshInFlight = (async () => {
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
        setCustomerTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          customerRefreshInFlight = null;
        }, 0);
      }
    })();
  }
  return customerRefreshInFlight;
}

async function customerFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const doFetch = (authToken?: string) =>
    fetch(`${coreUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...customerAuthHeaders(authToken ?? init?.token),
        ...init?.headers,
      },
    });

  let res = await doFetch();
  // Access token expires in 15m — refresh once and retry.
  if (res.status === 401 && !init?.token) {
    const newToken = await tryCustomerRefresh();
    if (newToken) {
      res = await doFetch(newToken);
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      clearCustomerSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign(
          `/login?error=${encodeURIComponent('Session expired — please sign in again')}`,
        );
      }
    }
  }
  return parseEnvelope<T>(res);
}

export type CustomerProfile = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  tin?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  siteCount?: number;
  contractCount?: number;
};

export type AccessEmployee = {
  id: string;
  organizationId: string;
  customerId: string;
  employeeNumber?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  accessCardRef?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AccessEntry = {
  id: string;
  organizationId: string;
  customerId: string;
  employeeId: string;
  siteId: string;
  gateId?: string | null;
  entryType: string;
  accessMethod: string;
  recordedAt: string;
  createdAt: string;
  employeeName?: string | null;
  employeeNumber?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

export type ParkingVehicle = {
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

export type ParkingPermit = {
  id: string;
  organizationId: string;
  vehicleId: string;
  siteId: string;
  permitNumber: string;
  permitType: string;
  status: string;
  validFrom: string;
  validUntil: string;
  plateNumber?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

/** Customer portal — sites scoped to the signed-in customer */
export type PortalSite = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
};

/** Assigned guards / deployments at customer sites */
export type PortalDeployment = {
  id: string;
  status: string;
  startAt: string;
  endAt?: string | null;
  site: { id: string; code: string; name: string };
  guard: {
    id: string;
    guardNumber: string;
    fullName?: string | null;
    status?: string;
  };
};

export type PortalIncident = {
  id: string;
  incidentNumber: string;
  title: string;
  description?: string | null;
  category: string;
  severity: string;
  status: string;
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

export type PortalAttendanceClockedGuard = {
  guardId: string;
  guardNumber: string;
  fullName?: string | null;
  clockInAt: string;
  stillOnDuty: boolean;
};

export type PortalAttendanceSummary = {
  siteId: string;
  siteCode: string;
  siteName: string;
  clockedInToday: number;
  onDutyNow?: number;
  totalActiveDeployments: number;
  clockedGuards?: PortalAttendanceClockedGuard[];
};

/** Contract row may include SLA text from contracts.sla_terms */
export type CustomerContractView = Contract & {
  slaTerms?: string | null;
  guardCount?: number | null;
  serviceTypes?: string[];
  paymentTerms?: string | null;
};

/** Customer portal login → core-api POST /auth/login */
export async function customerLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

/** GET /customers/me */
export const getCustomerMe = (token?: string) =>
  customerFetch<CustomerProfile>('/api/v1/customers/me', { token });

/** GET /contracts (customer-scoped by JWT) */
export const listCustomerContracts = (token?: string) =>
  customerFetch<Contract[]>('/api/v1/contracts', { token });

/** GET /finance/invoices */
export const listCustomerInvoices = (token?: string) =>
  customerFetch<Invoice[]>('/api/v1/finance/invoices', { token });

/** GET /visitors/appointments */
export const listCustomerVisitors = (token?: string) =>
  customerFetch<VisitorAppointment[]>('/api/v1/visitors/appointments', {
    token,
  });

/** POST /visitors/appointments/:id/approve — host issues gate code */
export const approveCustomerVisitor = (id: string, token?: string) =>
  customerFetch<{
    appointment: VisitorAppointment;
    verificationCode: string;
    validUntil: string;
    siteId: string;
    gateId?: string | null;
  }>(`/api/v1/visitors/appointments/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

/** POST /visitors/appointments/:id/reject — host declines appointment */
export const rejectCustomerVisitor = (
  id: string,
  body: { reason: string },
  token?: string,
) =>
  customerFetch<VisitorAppointment>(
    `/api/v1/visitors/appointments/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** GET /access/employees */
export const listCustomerAccessEmployees = (token?: string) =>
  customerFetch<AccessEmployee[]>('/api/v1/access/employees', { token });

/** GET /access/entries (customer-scoped) */
export const listCustomerAccessEntries = (token?: string) =>
  customerFetch<AccessEntry[]>('/api/v1/access/entries', { token });

/** GET /parking/vehicles */
export const listCustomerParkingVehicles = (token?: string) =>
  customerFetch<ParkingVehicle[]>('/api/v1/parking/vehicles', { token });

/** GET /parking/permits */
export const listCustomerParkingPermits = (token?: string) =>
  customerFetch<ParkingPermit[]>('/api/v1/parking/permits', { token });

/**
 * Customer portal live slices (JWT customer-scoped).
 * Paths align with core-api `/customers/me/*` portal extensions.
 */
export const getCustomerPortalSites = (token?: string) =>
  customerFetch<PortalSite[]>('/api/v1/customers/me/sites', { token });

export const getCustomerPortalDeployments = (token?: string) =>
  customerFetch<PortalDeployment[]>('/api/v1/customers/me/deployments', {
    token,
  });

export const getCustomerPortalIncidents = (token?: string) =>
  customerFetch<PortalIncident[]>('/api/v1/customers/me/incidents', {
    token,
  });

export const getCustomerPortalAttendanceSummary = (token?: string) =>
  customerFetch<PortalAttendanceSummary[]>(
    '/api/v1/customers/me/attendance-summary',
    { token },
  );

/** GET /documents?resourceType=Customer&resourceId=… — own customer attachments */
export const listCustomerAttachedDocuments = (
  customerId: string,
  token?: string,
) => {
  const q = new URLSearchParams({
    resourceType: 'Customer',
    resourceId: customerId,
  });
  return customerFetch<
    Array<{
      id: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      createdAt: string;
    }>
  >(`/api/v1/documents?${q.toString()}`, { token });
};

/** GET /documents?resourceType=Contract&resourceId=… — own contract attachments */
export const listCustomerContractDocuments = (
  contractId: string,
  token?: string,
) => {
  const q = new URLSearchParams({
    resourceType: 'Contract',
    resourceId: contractId,
  });
  return customerFetch<
    Array<{
      id: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      createdAt: string;
      resourceId?: string;
    }>
  >(`/api/v1/documents?${q.toString()}`, { token });
};

/** GET /documents/:id/download-url — presigned MinIO GET */
export const getCustomerAttachedDocumentUrl = (id: string, token?: string) =>
  customerFetch<{
    url: string;
    expiresInSeconds: number;
    fileName: string;
    contentType: string;
  }>(`/api/v1/documents/${id}/download-url`, { token });

/** POST /auth/change-password — clears mustChangePassword, returns fresh tokens */
export const changeCustomerPassword = (
  body: { currentPassword: string; newPassword: string },
  token?: string,
) =>
  customerFetch<LoginResult>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export type ServiceRequestCategory =
  | 'EXTRA_GUARDS'
  | 'COVERAGE'
  | 'ACCESS'
  | 'VISITOR'
  | 'BILLING'
  | 'OTHER';

export type ServiceRequestUrgency = 'SAME_DAY' | 'THIS_WEEK' | 'PLANNING';

export type ServiceRequestStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type CustomerServiceRequest = {
  id: string;
  customerId: string;
  referenceNumber: string;
  category: ServiceRequestCategory;
  urgency: ServiceRequestUrgency;
  status: ServiceRequestStatus;
  title: string;
  description: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  callbackPhone?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  customerCode?: string | null;
  customerName?: string | null;
};

export type CreateServiceRequestBody = {
  category: ServiceRequestCategory;
  urgency?: ServiceRequestUrgency;
  title: string;
  description: string;
  siteId?: string;
  callbackPhone?: string;
};

/** GET /customers/me/service-requests */
export const listCustomerServiceRequests = (token?: string) =>
  customerFetch<CustomerServiceRequest[]>(
    '/api/v1/customers/me/service-requests',
    { token },
  );

/** POST /customers/me/service-requests */
export const createCustomerServiceRequest = (
  body: CreateServiceRequestBody,
  token?: string,
) =>
  customerFetch<CustomerServiceRequest>(
    '/api/v1/customers/me/service-requests',
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** POST /customers/me/service-requests/:id/cancel */
export const cancelCustomerServiceRequest = (id: string, token?: string) =>
  customerFetch<CustomerServiceRequest>(
    `/api/v1/customers/me/service-requests/${id}/cancel`,
    { method: 'POST', body: JSON.stringify({}), token },
  );
