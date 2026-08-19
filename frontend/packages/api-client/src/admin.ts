import type { LoginResult } from './index';
import {
  authHeaders,
  clearSession,
  getRefreshToken,
  setTokens,
} from '@pssms/auth';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4001';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

/** Single-flight refresh so concurrent 401s share one refresh call. */
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
        // reset after microtask so awaiting callers still read the value
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
  // Access token likely expired (15m TTL) — refresh once and retry.
  if (res.status === 401 && !init?.token) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await doFetch(newToken);
    }
    // Still unauthenticated → stale session; force fresh login.
    if (res.status === 401 && typeof window !== 'undefined') {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign(
          `/login?error=${encodeURIComponent('Session expired — please sign in again')}`,
        );
      }
    }
  }
  return parseEnvelope<T>(res);
}

// ── Customers ──
export type CustomerLifecycleStatus =
  | 'PROSPECT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'TERMINATED';

export type CustomerSiteSummary = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
};

export type Customer = {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  tradingName?: string | null;
  tin?: string | null;
  vrn?: string | null;
  businessLicense?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  postalAddress?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  contactDesignation?: string | null;
  billingEmail?: string | null;
  opsEmail?: string | null;
  website?: string | null;
  category?: string | null;
  industry?: string | null;
  ranking?: string | null;
  status?: CustomerLifecycleStatus;
  serviceTypes?: string[];
  preferredStartDate?: string | null;
  estimatedGuards?: number | null;
  specialRequirements?: string | null;
  slaLevel?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  creditLimit?: string | null;
  currency?: string | null;
  invoiceFrequency?: string | null;
  taxExempt?: boolean;
  accountManagerName?: string | null;
  branchId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  siteCount?: number;
  contractCount?: number;
  sites?: CustomerSiteSummary[];
};

export type CreateCustomerBody = {
  code?: string;
  name: string;
  tradingName?: string;
  category?: string;
  industry?: string;
  ranking?: string;
  status?: CustomerLifecycleStatus;
  tin?: string;
  vrn?: string;
  businessLicense?: string;
  address?: string;
  postalAddress?: string;
  city?: string;
  region?: string;
  country?: string;
  contactPerson?: string;
  contactDesignation?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  billingEmail?: string;
  opsEmail?: string;
  website?: string;
  serviceTypes?: string[];
  preferredStartDate?: string;
  estimatedGuards?: number;
  specialRequirements?: string;
  slaLevel?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  creditLimit?: number;
  currency?: string;
  invoiceFrequency?: string;
  taxExempt?: boolean;
  accountManagerName?: string;
  branchId?: string;
  saveAsDraft?: boolean;
};

/** Module 6-D — profile + commercial/billing patch (null clears optional strings). */
export type UpdateCustomerBody = {
  name?: string;
  tradingName?: string | null;
  category?: string | null;
  industry?: string | null;
  ranking?: string | null;
  status?: CustomerLifecycleStatus;
  tin?: string | null;
  vrn?: string | null;
  businessLicense?: string | null;
  address?: string | null;
  postalAddress?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  contactDesignation?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  billingEmail?: string | null;
  opsEmail?: string | null;
  website?: string | null;
  serviceTypes?: string[];
  preferredStartDate?: string | null;
  estimatedGuards?: number | null;
  specialRequirements?: string | null;
  slaLevel?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  creditLimit?: number | null;
  currency?: string | null;
  invoiceFrequency?: string | null;
  taxExempt?: boolean;
  accountManagerName?: string | null;
  branchId?: string | null;
  isActive?: boolean;
};

export const listCustomers = (token?: string) =>
  coreFetch<Customer[]>('/api/v1/customers', { token });

export const getCustomer = (id: string, token?: string) =>
  coreFetch<Customer>(`/api/v1/customers/${id}`, { token });

/** Module 6-E — CRM-gated site create (forces customerId server-side) */
export type CustomerSite = {
  id: string;
  organizationId: string;
  branchId: string;
  customerId?: string | null;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
};

export type CreateCustomerSiteBody = {
  branchId: string;
  code: string;
  name: string;
  address?: string;
};

export type UpdateCustomerSiteBody = {
  name?: string;
  address?: string | null;
  isActive?: boolean;
};

export const createCustomerSite = (
  customerId: string,
  body: CreateCustomerSiteBody,
  token?: string,
) =>
  coreFetch<CustomerSite>(`/api/v1/customers/${customerId}/sites`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Module 6-F — edit/deactivate customer-linked site */
export const updateCustomerSite = (
  customerId: string,
  siteId: string,
  body: UpdateCustomerSiteBody,
  token?: string,
) =>
  coreFetch<CustomerSite>(
    `/api/v1/customers/${customerId}/sites/${siteId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );

/** Module 6-G — CRM customer employees (register roster; no portal bind) */
export type CustomerEmployeeStaff = {
  id: string;
  organizationId: string;
  customerId: string;
  userId?: string | null;
  employeeNumber?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  accessLevel?: 'STANDARD' | 'RESTRICTED' | 'ELEVATED';
  accessCardRef?: string | null;
  biometricRef?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateCustomerEmployeeStaffBody = {
  fullName: string;
  employeeNumber?: string;
  email?: string;
  phone?: string;
  department?: string;
  accessLevel?: 'STANDARD' | 'RESTRICTED' | 'ELEVATED';
  accessCardRef?: string;
  biometricRef?: string;
};

export const listCustomerEmployees = (customerId: string, token?: string) =>
  coreFetch<CustomerEmployeeStaff[]>(
    `/api/v1/customers/${customerId}/employees`,
    { token },
  );

export const createCustomerEmployee = (
  customerId: string,
  body: CreateCustomerEmployeeStaffBody,
  token?: string,
) =>
  coreFetch<CustomerEmployeeStaff>(
    `/api/v1/customers/${customerId}/employees`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

/** Module 6-H — edit/deactivate customer employee */
export type UpdateCustomerEmployeeStaffBody = {
  fullName?: string;
  employeeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  accessLevel?: 'STANDARD' | 'RESTRICTED' | 'ELEVATED';
  accessCardRef?: string | null;
  biometricRef?: string | null;
  isActive?: boolean;
};

export const updateCustomerEmployee = (
  customerId: string,
  employeeId: string,
  body: UpdateCustomerEmployeeStaffBody,
  token?: string,
) =>
  coreFetch<CustomerEmployeeStaff>(
    `/api/v1/customers/${customerId}/employees/${employeeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );

/** Module 11-C — site grants (empty siteIds = unrestricted) */
export type CustomerEmployeeSites = {
  employeeId: string;
  customerId: string;
  unrestricted: boolean;
  siteIds: string[];
  sites: { id: string; code: string; name: string; isActive: boolean }[];
};

export const getCustomerEmployeeSites = (
  customerId: string,
  employeeId: string,
  token?: string,
) =>
  coreFetch<CustomerEmployeeSites>(
    `/api/v1/customers/${customerId}/employees/${employeeId}/sites`,
    { token },
  );

export const setCustomerEmployeeSites = (
  customerId: string,
  employeeId: string,
  siteIds: string[],
  token?: string,
) =>
  coreFetch<CustomerEmployeeSites>(
    `/api/v1/customers/${customerId}/employees/${employeeId}/sites`,
    {
      method: 'PUT',
      body: JSON.stringify({ siteIds }),
      token,
    },
  );

/** Module 6-I — invite CUSTOMER_EMPLOYEE login + bind userId */
export type InviteCustomerEmployeePortalResult = {
  employee: CustomerEmployeeStaff;
  userId: string;
  email: string;
  temporaryPassword: string;
  notificationQueued: boolean;
};

export const inviteCustomerEmployeePortal = (
  customerId: string,
  employeeId: string,
  token?: string,
) =>
  coreFetch<InviteCustomerEmployeePortalResult>(
    `/api/v1/customers/${customerId}/employees/${employeeId}/invite-portal`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      token,
    },
  );

/** Module 6-A — staff customer 360 overview */
export type CustomerOverview = {
  customerId: string;
  code: string;
  name: string;
  counts: {
    sites: number;
    contracts: number;
    employees: number;
    activeGuards: number;
    invoices: number;
    openInvoices: number;
    overdueInvoices: number;
    openServiceRequests: number;
    openComplaints: number;
    openIncidents: number;
    vehicles: number;
    activePermits: number;
    accessEntries30d: number;
    pendingAppointments: number;
  };
  billing: {
    currency: string;
    outstandingAmount: number;
    paidAmount: number;
  };
  contracts: {
    id: string;
    contractNumber: string;
    title: string;
    status: string;
    serviceType: string;
    monthlyFee: number;
    currency: string;
  }[];
  guards: {
    deploymentId: string;
    guardId: string;
    guardNumber: string;
    fullName: string | null;
    siteCode: string;
    siteName: string;
    status: string;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    currency: string;
    dueDate: string;
  }[];
  incidents: {
    id: string;
    incidentNumber: string;
    title: string;
    severity: string;
    status: string;
    siteCode: string | null;
    createdAt: string;
  }[];
  serviceRequests: {
    id: string;
    referenceNumber: string;
    title: string;
    category: string;
    status: string;
    urgency: string;
    createdAt: string;
  }[];
  complaints: {
    id: string;
    referenceNumber: string;
    title: string;
    category: string;
    severity: string;
    status: string;
    createdAt: string;
  }[];
  employees: {
    id: string;
    employeeNumber: string | null;
    fullName: string;
    department: string | null;
    isActive: boolean;
  }[];
  vehicles: {
    id: string;
    plateNumber: string;
    vehicleType: string;
    ownerName: string | null;
    isActive: boolean;
  }[];
};

export const getCustomerOverview = (id: string, token?: string) =>
  coreFetch<CustomerOverview>(`/api/v1/customers/${id}/overview`, { token });

/** Module 6-L — assigned guards roster (deployments on customer sites) */
export type CustomerAssignedGuard = {
  deploymentId: string;
  guardId: string;
  guardNumber: string;
  fullName?: string | null;
  guardStatus: string;
  deploymentEligible: boolean;
  siteId: string;
  siteCode: string;
  siteName: string;
  contractId?: string | null;
  contractNumber?: string | null;
  deploymentStatus: string;
  startDate: string;
  endDate?: string | null;
};

export const listCustomerAssignedGuards = (
  customerId: string,
  opts?: { status?: 'ACTIVE' | 'ENDED' | 'ALL'; token?: string },
) => {
  const q =
    opts?.status && opts.status !== 'ACTIVE'
      ? `?status=${encodeURIComponent(opts.status)}`
      : '';
  return coreFetch<CustomerAssignedGuard[]>(
    `/api/v1/customers/${customerId}/guards${q}`,
    { token: opts?.token },
  );
};

/** Module 6-M — customer contacts directory */
export type CustomerContactRole =
  | 'GENERAL'
  | 'BILLING'
  | 'OPERATIONS'
  | 'SECURITY'
  | 'OTHER';

export type CustomerContact = {
  id: string;
  organizationId: string;
  customerId: string;
  fullName: string;
  designation?: string | null;
  role: CustomerContactRole;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
};

export type CreateCustomerContactBody = {
  fullName: string;
  designation?: string;
  role?: CustomerContactRole;
  email?: string;
  phone?: string;
  altPhone?: string;
  isPrimary?: boolean;
  notes?: string;
};

export type UpdateCustomerContactBody = {
  fullName?: string;
  designation?: string | null;
  role?: CustomerContactRole;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string | null;
};

export const listCustomerContacts = (customerId: string, token?: string) =>
  coreFetch<CustomerContact[]>(`/api/v1/customers/${customerId}/contacts`, {
    token,
  });

export const createCustomerContact = (
  customerId: string,
  body: CreateCustomerContactBody,
  token?: string,
) =>
  coreFetch<CustomerContact>(`/api/v1/customers/${customerId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateCustomerContact = (
  customerId: string,
  contactId: string,
  body: UpdateCustomerContactBody,
  token?: string,
) =>
  coreFetch<CustomerContact>(
    `/api/v1/customers/${customerId}/contacts/${contactId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );

/** Module 6-C — staff customer report pack */
export type CustomerReport = {
  customerId: string;
  code: string;
  name: string;
  period: { from: string; to: string };
  summary: {
    sites: number;
    activeGuards: number;
    incidentsOpened: number;
    incidentsStillOpen: number;
    attendanceClockIns: number;
    accessEntries: number;
    visitorAppointments: number;
    visitorGateEntries: number;
    parkingEntries: number;
    complaintsOpened: number;
    complaintsStillOpen: number;
    serviceRequestsOpened: number;
    invoicesIssued: number;
    invoiceOutstandingAmount: number;
    currency: string;
  };
  bySite: {
    siteId: string;
    siteCode: string;
    siteName: string;
    incidentsOpened: number;
    attendanceClockIns: number;
    accessEntries: number;
    visitorGateEntries: number;
    parkingEntries: number;
  }[];
  generatedAt: string;
  notes: string[];
};

export const getCustomerReport = (
  id: string,
  opts?: { from?: string; to?: string; token?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set('from', opts.from);
  if (opts?.to) qs.set('to', opts.to);
  const q = qs.toString();
  return coreFetch<CustomerReport>(
    `/api/v1/customers/${id}/reports${q ? `?${q}` : ''}`,
    { token: opts?.token },
  );
};

export const createCustomer = (body: CreateCustomerBody, token?: string) =>
  coreFetch<Customer>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateCustomer = (
  id: string,
  body: UpdateCustomerBody,
  token?: string,
) =>
  coreFetch<Customer>(`/api/v1/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export type CustomerPortalUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  organizationId: string;
  customerId?: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
};

export type InviteCustomerPortalUserBody = {
  email: string;
  fullName: string;
  phone?: string;
};

export type InviteCustomerPortalUserResult = CustomerPortalUser & {
  temporaryPassword: string;
  notificationQueued: boolean;
};

export const listCustomerPortalUsers = (customerId: string, token?: string) =>
  coreFetch<CustomerPortalUser[]>(
    `/api/v1/customers/${customerId}/portal-users`,
    { token },
  );

export const inviteCustomerPortalUser = (
  customerId: string,
  body: InviteCustomerPortalUserBody,
  token?: string,
) =>
  coreFetch<InviteCustomerPortalUserResult>(
    `/api/v1/customers/${customerId}/portal-users`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

// ── Contracts ──
export type ContractSiteSummary = {
  id: string;
  code: string;
  name: string;
};

export const CONTRACT_KINDS = ['NEW', 'RENEWAL', 'AMENDMENT'] as const;
export const CONTRACT_INVOICE_FREQUENCIES = ['MONTHLY', 'WEEKLY'] as const;
export const CONTRACT_SLA_LEVELS = ['STANDARD', 'PREMIUM', 'CRITICAL'] as const;

export type ContractKind = (typeof CONTRACT_KINDS)[number];
export type ContractInvoiceFrequency =
  (typeof CONTRACT_INVOICE_FREQUENCIES)[number];
export type ContractSlaLevel = (typeof CONTRACT_SLA_LEVELS)[number];

export type Contract = {
  id: string;
  customerId: string;
  contractNumber: string;
  title: string;
  /** Primary / display type (first of serviceTypes). */
  serviceType: string;
  serviceTypes?: string[];
  status: string;
  monthlyFee: string;
  currency: string;
  paymentTerms?: string | null;
  contractKind?: string;
  renewalDate?: string | null;
  noticePeriodDays?: number;
  invoiceFrequency?: string | null;
  vatApplicable?: boolean;
  slaLevel?: string | null;
  startDate: string;
  endDate: string;
  guardCount?: number | null;
  slaTerms?: string | null;
  approvalInstanceId?: string | null;
  /** Approval instance status when pending/approved via contract-approval. */
  approvalStatus?: string;
  approvalCurrentStepOrder?: number;
  approvalCurrentStepName?: string | null;
  approvalRequiredRole?: string | null;
  /** Bound enterprise site ids (B2). */
  siteIds?: string[];
  sites?: ContractSiteSummary[];
};

export const listContracts = (
  tokenOrOpts?: string | { customerId?: string; token?: string },
) => {
  const opts =
    typeof tokenOrOpts === 'string'
      ? { token: tokenOrOpts }
      : (tokenOrOpts ?? {});
  const q = opts.customerId
    ? `?customerId=${encodeURIComponent(opts.customerId)}`
    : '';
  return coreFetch<Contract[]>(`/api/v1/contracts${q}`, { token: opts.token });
};

export type CreateContractBody = {
  customerId: string;
  contractNumber: string;
  title: string;
  /** Preferred — min 1 canonical code. */
  serviceTypes?: string[];
  /** @deprecated Prefer serviceTypes */
  serviceType?: string;
  startDate: string;
  endDate: string;
  monthlyFee: number;
  currency?: string;
  paymentTerms?: string;
  contractKind?: ContractKind;
  renewalDate?: string;
  noticePeriodDays?: number;
  invoiceFrequency?: ContractInvoiceFrequency;
  vatApplicable?: boolean;
  slaLevel?: ContractSlaLevel;
  guardCount?: number;
  slaTerms?: string;
  /** Optional sites covered by the agreement (must belong to customer). */
  siteIds?: string[];
};

export const createContract = (body: CreateContractBody, token?: string) =>
  coreFetch<Contract>('/api/v1/contracts', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Replace bound sites — DRAFT contracts only. */
export const replaceContractSites = (
  id: string,
  siteIds: string[],
  token?: string,
) =>
  coreFetch<Contract>(`/api/v1/contracts/${id}/sites`, {
    method: 'PUT',
    body: JSON.stringify({ siteIds }),
    token,
  });

export const updateContractStatus = (
  id: string,
  status: string,
  token?: string,
) =>
  coreFetch<Contract>(`/api/v1/contracts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  });

export const submitContract = (id: string, token?: string) =>
  coreFetch<Contract>(`/api/v1/contracts/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export const approveContract = (id: string, token?: string) =>
  coreFetch<Contract>(`/api/v1/contracts/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export const rejectContract = (
  id: string,
  body?: { reason?: string },
  token?: string,
) =>
  coreFetch<Contract>(`/api/v1/contracts/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

export type ContractScanExpiringResult = {
  scannedAt: string;
  daysAhead: number;
  markedExpiring: number;
  notificationsQueued: number;
  contracts: Array<{
    id: string;
    contractNumber: string;
    customerId: string;
    endDate: string;
    status: string;
  }>;
};

export type ContractCommercialAlerts = {
  expiring: Contract[];
  unpaidByCustomer: Array<{
    customerId: string;
    customerCode: string;
    customerName: string;
    openInvoiceCount: number;
    openBalance: string;
    currency: string;
    hasExpiringContract: boolean;
  }>;
};

/** POST /contracts/scan-expiring — ACTIVE→EXPIRING + EMAIL outbox */
export const scanExpiringContracts = (daysAhead = 90, token?: string) =>
  coreFetch<ContractScanExpiringResult>(
    `/api/v1/contracts/scan-expiring?daysAhead=${daysAhead}`,
    { method: 'POST', body: JSON.stringify({}), token },
  );

/** GET /contracts/commercial-alerts */
export const getContractCommercialAlerts = (token?: string) =>
  coreFetch<ContractCommercialAlerts>(
    '/api/v1/contracts/commercial-alerts',
    { token },
  );

// ── Guards ──
export type GuardActiveDeployment = {
  id: string;
  siteCode?: string;
  siteName?: string;
  status?: string;
};

/** Module 8 / Prisma GuardStatus */
export type GuardStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'ABSENT'
  | 'SUSPENDED'
  | 'TRANSFERRED'
  | 'TERMINATED'
  | 'AVAILABLE';

export type Guard = {
  id: string;
  employeeNumber: string;
  status: GuardStatus | string;
  deploymentEligible: boolean;
  /** Module 8-A — ACTIVE / AVAILABLE */
  canToggleDeployable?: boolean;
  /** Module 8-A — allowed PATCH status targets */
  allowedNextStatuses?: GuardStatus[];
  /** G3 thin readiness checklist */
  trainingCompleted?: boolean;
  firearmAuthorized?: boolean;
  firearmExpiry?: string | null;
  clearanceVerified?: boolean;
  /** Module 8-B */
  medicalFitnessVerified?: boolean;
  medicalFitnessExpiry?: string | null;
  nationalIdRef?: string | null;
  /** Module 8-C */
  uniformIssued?: boolean;
  equipmentIssued?: boolean;
  /** Module 8-E — open punches closed when status → ABSENT */
  closedAttendanceIds?: string[];
  /** Module 8-F — SCHEDULED alertness cancelled when status → ABSENT */
  cancelledAlertnessIds?: string[];
  userId: string;
  /** Present when backend joins employee / profile fields */
  phone?: string | null;
  photoUrl?: string | null;
  fullName?: string | null;
  employeeId?: string | null;
  activeDeployment?: GuardActiveDeployment | null;
  createdAt?: string;
  organizationId?: string;
};

type GuardApiRow = Guard & {
  employee?: { employeeId: string; fullName: string } | null;
};

/** Flatten nested employee join for ops UI. */
function normalizeGuard(row: GuardApiRow): Guard {
  const { employee, ...rest } = row;
  return {
    ...rest,
    fullName: rest.fullName ?? employee?.fullName ?? null,
    employeeId: rest.employeeId ?? employee?.employeeId ?? null,
  };
}

export const listGuards = async (token?: string) => {
  const rows = await coreFetch<GuardApiRow[]>('/api/v1/guards', { token });
  return rows.map(normalizeGuard);
};

export type GuardLinkableUser = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
};

export type CreateGuardBody = {
  userId: string;
  employeeNumber: string;
  phone?: string;
  employeeId?: string;
  deploymentEligible?: boolean;
};

export const listGuardLinkableUsers = (token?: string) =>
  coreFetch<GuardLinkableUser[]>('/api/v1/guards/linkable-users', { token });

export const createGuard = async (body: CreateGuardBody, token?: string) => {
  const row = await coreFetch<GuardApiRow>('/api/v1/guards', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
  return normalizeGuard(row);
};

export const updateGuardStatus = async (
  id: string,
  status: string,
  options?: {
    deploymentEligible?: boolean;
    /** Module 8-E — optional ABSENT note */
    reason?: string;
    token?: string;
  },
) => {
  const row = await coreFetch<GuardApiRow>(`/api/v1/guards/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(options?.deploymentEligible !== undefined
        ? { deploymentEligible: options.deploymentEligible }
        : {}),
      ...(options?.reason?.trim() ? { reason: options.reason.trim() } : {}),
    }),
    token: options?.token,
  });
  return normalizeGuard(row);
};

export type UpdateGuardReadinessBody = {
  trainingCompleted?: boolean;
  firearmAuthorized?: boolean;
  /** ISO date YYYY-MM-DD, or null to clear */
  firearmExpiry?: string | null;
  clearanceVerified?: boolean;
  /** Module 8-B */
  medicalFitnessVerified?: boolean;
  medicalFitnessExpiry?: string | null;
  nationalIdRef?: string | null;
  /** Module 8-C */
  uniformIssued?: boolean;
  equipmentIssued?: boolean;
};

export const updateGuardReadiness = async (
  id: string,
  body: UpdateGuardReadinessBody,
  token?: string,
) => {
  const row = await coreFetch<GuardApiRow>(`/api/v1/guards/${id}/readiness`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
  return normalizeGuard(row);
};

// ── Finance ──
export const INVOICE_SERVICE_TYPES = [
  'SECURITY_GUARD',
  'CCTV_MONITORING',
  'ACCESS_CONTROL',
  'VISITOR_MANAGEMENT',
  'PARKING',
  'RECRUITMENT',
  'CUSTOMER_PAYROLL',
  'ALARM_RESPONSE',
  'TECHNICAL',
  'OTHER',
] as const;

export type InvoiceServiceType = (typeof INVOICE_SERVICE_TYPES)[number];

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  contractId?: string | null;
  contractNumber?: string | null;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  issueDate?: string;
  serviceType?: string | null;
  notes?: string | null;
};

export const listInvoices = (
  tokenOrOpts?: string | { customerId?: string; contractId?: string; token?: string },
) => {
  const opts =
    typeof tokenOrOpts === 'string'
      ? { token: tokenOrOpts }
      : (tokenOrOpts ?? {});
  const params = new URLSearchParams();
  if (opts.customerId) params.set('customerId', opts.customerId);
  if (opts.contractId) params.set('contractId', opts.contractId);
  const q = params.toString() ? `?${params}` : '';
  return coreFetch<Invoice[]>(`/api/v1/finance/invoices${q}`, {
    token: opts.token,
  });
};

export const createInvoice = (
  body: {
    customerId: string;
    contractId?: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    taxAmount?: number;
    currency?: string;
    serviceType?: string;
    notes?: string;
    lines: { description: string; quantity: number; unitPrice: number }[];
  },
  token?: string,
) =>
  coreFetch<Invoice>('/api/v1/finance/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const sendInvoice = (id: string, token?: string) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/send`, {
    method: 'POST',
    token,
  });

export const voidInvoice = (
  id: string,
  body?: { reason?: string },
  token?: string,
) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/void`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

export const disputeInvoice = (
  id: string,
  body?: { reason?: string },
  token?: string,
) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/dispute`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

export const closeInvoice = (id: string, token?: string) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/close`, {
    method: 'POST',
    token,
  });

export type InvoiceScanOverdueResult = {
  markedOverdue: number;
  invoiceNumbers: string[];
  overdueNotified?: number;
  unpaidReminders?: number;
  suspensionRisks?: number;
};

export const scanOverdueInvoices = (token?: string) =>
  coreFetch<InvoiceScanOverdueResult>(
    '/api/v1/finance/invoices/scan-overdue',
    { method: 'POST', token },
  );

export type InvoiceAlertItem = {
  kind: string;
  invoiceId?: string;
  invoiceNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  serviceType?: string | null;
  status?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  message: string;
};

export type InvoiceAlertsPack = {
  overdue: InvoiceAlertItem[];
  unpaid: InvoiceAlertItem[];
  completedPayments: InvoiceAlertItem[];
  payrollDueInvoices: InvoiceAlertItem[];
  contractExpiry: InvoiceAlertItem[];
  suspensionRisk: InvoiceAlertItem[];
};

export const listInvoiceAlerts = (token?: string) =>
  coreFetch<InvoiceAlertsPack>('/api/v1/finance/invoices/alerts', { token });

export const recordInvoicePayment = (
  id: string,
  body: { amount: number; paymentReference: string },
  token?: string,
) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Enterprise ──
export type Branch = {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  region?: string | null;
  isActive: boolean;
  createdAt?: string;
};

export const listBranches = (token?: string) =>
  coreFetch<Branch[]>('/api/v1/enterprise/branches', { token });

export const createBranch = (
  body: { code: string; name: string; region?: string },
  token?: string,
) =>
  coreFetch<Branch>('/api/v1/enterprise/branches', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateBranch = (
  id: string,
  body: { name?: string; region?: string; isActive?: boolean },
  token?: string,
) =>
  coreFetch<Branch>(`/api/v1/enterprise/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export type Department = {
  id: string;
  organizationId: string;
  branchId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
};

export const listDepartments = (token?: string) =>
  coreFetch<Department[]>('/api/v1/enterprise/departments', { token });

export const createDepartment = (
  body: { code: string; name: string; branchId?: string },
  token?: string,
) =>
  coreFetch<Department>('/api/v1/enterprise/departments', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateDepartment = (
  id: string,
  body: { name?: string; isActive?: boolean },
  token?: string,
) =>
  coreFetch<Department>(`/api/v1/enterprise/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export type OrganizationProfile = {
  id: string;
  name: string;
  code: string;
  tin?: string | null;
  isActive: boolean;
};

export const getOrganization = (token?: string) =>
  coreFetch<OrganizationProfile>('/api/v1/enterprise/organization', { token });

// ── Identity / Users (Module 5 · Super Admin) ──
export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  organizationId: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
  lastLoginAt?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  roles: string[];
  createdAt: string;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type CreateAdminUserBody = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roleCodes: string[];
};

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  summary?: string;
};

export const getPasswordPolicy = (token?: string) =>
  coreFetch<PasswordPolicy>('/api/v1/users/password-policy', { token });

export const setPasswordPolicy = (body: PasswordPolicy, token?: string) =>
  coreFetch<PasswordPolicy>('/api/v1/users/password-policy', {
    method: 'PUT',
    body: JSON.stringify(body),
    token,
  });

export const listUsers = (token?: string) =>
  coreFetch<AdminUser[]>('/api/v1/users', { token });

export const createUser = (body: CreateAdminUserBody, token?: string) =>
  coreFetch<AdminUser>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** M5-I — admin sets temporary password; target must change on next login. */
export const resetUserPassword = (
  id: string,
  password: string,
  token?: string,
) =>
  coreFetch<AdminUser>(`/api/v1/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
    token,
  });

/** M5-J — admin clears another user’s TOTP MFA. */
export const resetUserMfa = (id: string, token?: string) =>
  coreFetch<AdminUser>(`/api/v1/users/${id}/mfa/reset`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export const setUserRoles = (
  id: string,
  roleCodes: string[],
  token?: string,
) =>
  coreFetch<AdminUser>(`/api/v1/users/${id}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roleCodes }),
    token,
  });

export type IamChangeRequest = {
  id: string;
  targetUserId: string;
  targetEmail?: string;
  targetFullName?: string;
  changeType: string;
  proposedRoleCodes: string[];
  previousRoleCodes: string[];
  reason?: string | null;
  status: string;
  approvalInstanceId?: string | null;
  createdBy: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  rejectReason?: string | null;
  createdAt: string;
};

/** M5-E — submit role change for GM approval (IT/CISO). */
export const submitUserRoleChange = (
  id: string,
  roleCodes: string[],
  token?: string,
) =>
  coreFetch<IamChangeRequest>(`/api/v1/users/${id}/roles/submit`, {
    method: 'POST',
    body: JSON.stringify({ roleCodes }),
    token,
  });

export const listRoleChangeRequests = (
  status?: string,
  token?: string,
) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<IamChangeRequest[]>(
    `/api/v1/users/role-change-requests${q}`,
    { token },
  );
};

export const approveRoleChangeRequest = (requestId: string, token?: string) =>
  coreFetch<IamChangeRequest>(
    `/api/v1/users/role-change-requests/${requestId}/approve`,
    { method: 'POST', body: JSON.stringify({}), token },
  );

export const rejectRoleChangeRequest = (
  requestId: string,
  reason?: string,
  token?: string,
) =>
  coreFetch<IamChangeRequest>(
    `/api/v1/users/role-change-requests/${requestId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      token,
    },
  );

export const suspendUser = (id: string, reason?: string, token?: string) =>
  coreFetch<AdminUser>(`/api/v1/users/${id}/suspend`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
    token,
  });

/** M5-F — submit suspend for GM approval (IT/CISO). */
export const submitUserSuspend = (
  id: string,
  reason?: string,
  token?: string,
) =>
  coreFetch<IamChangeRequest>(`/api/v1/users/${id}/suspend/submit`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const reactivateUser = (id: string, token?: string) =>
  coreFetch<AdminUser>(`/api/v1/users/${id}/reactivate`, {
    method: 'PATCH',
    body: JSON.stringify({}),
    token,
  });

/** M5-G — submit reactivate for GM approval (IT/CISO). */
export const submitUserReactivate = (
  id: string,
  reason?: string,
  token?: string,
) =>
  coreFetch<IamChangeRequest>(`/api/v1/users/${id}/reactivate/submit`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const listRoles = (token?: string) =>
  coreFetch<AdminRole[]>('/api/v1/roles', { token });

export type PermissionCatalogItem = {
  code: string;
  name: string;
  module: string;
};

export const listPermissions = (token?: string) =>
  coreFetch<PermissionCatalogItem[]>('/api/v1/roles/permissions', { token });

export type PortalCatalogRoleLive = {
  code: string;
  present: boolean;
  isSystem: boolean;
  userCount: number;
  canEnter: boolean;
};

export type PortalCatalogPortal = {
  id: string;
  name: string;
  primaryUsers: string;
  job: string;
  entry: string;
  gatePermissions: string[];
  accountTypeCodes: string[];
  roleCodes: string[];
  security: string;
  publicAccess: boolean;
  roles: PortalCatalogRoleLive[];
  liveUserCount: number;
};

export type PortalCatalogAccount = {
  code: string;
  name: string;
  roleCodes: string[];
  portalIds: string[];
  liveUserCount: number;
  publicOrUnbound: boolean;
};

export type PortalCatalog = {
  organizationId: string;
  portals: PortalCatalogPortal[];
  accountTypes: PortalCatalogAccount[];
  unmappedRoleCodes: string[];
};

export const getPortalCatalog = (token?: string) =>
  coreFetch<PortalCatalog>('/api/v1/roles/portal-catalog', { token });

export const createRole = (
  body: {
    code: string;
    name: string;
    description?: string;
    permissionCodes?: string[];
  },
  token?: string,
) =>
  coreFetch<AdminRole>('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const setRolePermissions = (
  id: string,
  permissionCodes: string[],
  token?: string,
) =>
  coreFetch<AdminRole>(`/api/v1/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionCodes }),
    token,
  });

export type LoginHistoryEntry = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export const listLoginHistory = (
  params?: { userId?: string; success?: boolean; take?: number },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (params?.userId) q.set('userId', params.userId);
  if (params?.success !== undefined) q.set('success', String(params.success));
  if (params?.take !== undefined) q.set('take', String(params.take));
  const qs = q.toString();
  return coreFetch<LoginHistoryEntry[]>(
    `/api/v1/users/login-history${qs ? `?${qs}` : ''}`,
    { token },
  );
};

export type AccessBranch = { id: string; code: string; name: string };
export type AccessSite = {
  id: string;
  code: string;
  name: string;
  branchId: string;
};

export type UserAccess = {
  userId: string;
  branchIds: string[];
  siteIds: string[];
  branches: AccessBranch[];
  sites: AccessSite[];
  catalog: { branches: AccessBranch[]; sites: AccessSite[] };
};

export const getUserAccess = (userId: string, token?: string) =>
  coreFetch<UserAccess>(`/api/v1/users/${userId}/access`, { token });

export const setUserAccess = (
  userId: string,
  body: { branchIds: string[]; siteIds: string[] },
  token?: string,
) =>
  coreFetch<UserAccess>(`/api/v1/users/${userId}/access`, {
    method: 'PUT',
    body: JSON.stringify(body),
    token,
  });

// ── MFA (self · Module 5) ──
export type MfaStatus = { mfaEnabled: boolean };
export type MfaSetup = { secret: string; otpauthUri: string };

export const getMfaStatus = (token?: string) =>
  coreFetch<MfaStatus>('/api/v1/auth/mfa/status', { token });

export const setupMfa = (token?: string) =>
  coreFetch<MfaSetup>('/api/v1/auth/mfa/setup', {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export const enableMfa = (code: string, token?: string) =>
  coreFetch<MfaStatus>('/api/v1/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
    token,
  });

export const disableMfa = (code: string, token?: string) =>
  coreFetch<MfaStatus>('/api/v1/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
    token,
  });

// ── Audit ──
export type AuditLog = {
  id: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  createdAt: string;
};

export const listAuditLogs = (take = 20, token?: string) =>
  coreFetch<AuditLog[]>(`/api/v1/audit/logs?take=${take}`, { token });

// ── Health ──
/**
 * Browser-side probe of a single service health URL.
 * Prefer `getPlatformServicesHealth()` from `./developer` (JWT → core-api probes)
 * so CORS and mixed ports are handled server-side.
 *
 * Defaults used by admin-web when wiring optional client probes:
 *   NEXT_PUBLIC_CORE_API_URL            → http://localhost:4001
 *   NEXT_PUBLIC_REPORTING_API_URL       → http://localhost:4005
 *   NEXT_PUBLIC_VISION_AI_URL           → http://localhost:8000
 *   NEXT_PUBLIC_ANALYTICS_AI_URL        → http://localhost:8001
 *   NEXT_PUBLIC_INTEGRATION_GATEWAY_URL → http://localhost:4003
 *   NEXT_PUBLIC_REALTIME_GATEWAY_URL    → http://localhost:4004
 */
export async function checkServiceHealth(
  baseUrl: string,
  path = '/api/v1/health',
): Promise<{ status: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) return { status: 'down' };
    const json = (await res.json()) as {
      status?: string;
      data?: { status?: string };
    };
    if (json.data?.status) return { status: json.data.status };
    if (json.status) return { status: json.status };
    return { status: 'ok' };
  } catch {
    return { status: 'down' };
  }
}

// ── Approvals ──
export type ApprovalInstance = {
  id: string;
  resourceType: string;
  resourceId: string;
  status: string;
  currentStepOrder: number;
  createdBy: string;
  createdAt: string;
  currentStepName?: string | null;
  requiredRole?: string | null;
};

export const listApprovalInstances = (token?: string) =>
  coreFetch<ApprovalInstance[]>('/api/v1/approvals/instances', { token });

export type ApprovalWorkflowStep = {
  stepOrder: number;
  name: string;
  requiredRole: string;
  minApprovers: number;
  amountThreshold?: number | null;
};

export type ApprovalWorkflow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  steps: ApprovalWorkflowStep[];
};

export const listApprovalWorkflows = (token?: string) =>
  coreFetch<ApprovalWorkflow[]>('/api/v1/approvals/workflows', { token });

export const actOnApproval = (
  id: string,
  body: { decision: 'APPROVE' | 'REJECT'; remarks?: string },
  token?: string,
) =>
  coreFetch<ApprovalInstance>(`/api/v1/approvals/instances/${id}/actions`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Payroll (immutable snapshots only — never attendance) ──
export type PayrollCycle = {
  id: string;
  cycleCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  tenantType: string;
  createdBy: string;
  paymentReference?: string | null;
  billingInvoiceId?: string | null;
  createdAt: string;
};

export type PayrollDueAlert = {
  id: string;
  customerId: string;
  customerName?: string;
  customerCode?: string;
  payrollCycleId: string;
  cycleCode?: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  payrollMonth: string;
  invoiceAmountPaid: number;
  employeesCovered: number;
  payrollPortionDue: number;
  currency: string;
  dueDate: string;
  invoicePaymentStatus: string;
  payrollApprovalStatus: string;
  payrollPaymentStatus: string;
  responsibleOfficerId?: string | null;
  responsibleOfficerName?: string | null;
  status: string;
  notifiedAt?: string | null;
  createdAt: string;
};

export type PayrollInvoiceGate = {
  eligible: boolean;
  blockedReason?: string | null;
  blockedCode?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  amountPaid?: number | null;
  totalAmount?: number | null;
  exceptionApproved?: boolean;
};

export type PayslipSnapshot = {
  id: string;
  cycleId: string;
  employeeId?: string | null;
  customerEmployeeId?: string | null;
  employeeNumber: string;
  employeeName: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  ruleVersionId: string;
  inputsSnapshot?: unknown;
  allowancesSnapshot?: unknown;
  deductionsSnapshot?: unknown;
  calculationResult?: {
    lines?: Array<{
      code: string;
      label: string;
      amount: number;
      type: 'EARNING' | 'DEDUCTION';
    }>;
    grossPay?: number;
    totalDeductions?: number;
    netPay?: number;
    meta?: Record<string, unknown>;
  };
  createdAt: string;
};

export const listPayrollCycles = (
  opts?: { customerId?: string; tenantType?: string; token?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.customerId) qs.set('customerId', opts.customerId);
  if (opts?.tenantType) qs.set('tenantType', opts.tenantType);
  const q = qs.toString();
  return coreFetch<PayrollCycle[]>(
    `/api/v1/payroll/cycles${q ? `?${q}` : ''}`,
    { token: opts?.token },
  );
};

export type PayrollPortalTenantPack = {
  cycles: number;
  payslipSnapshots: number;
  grossPay: number;
  netPay: number;
  overtime: { count: number; amount: number };
  allowances: { count: number; amount: number };
  loanDeductions: { count: number; amount: number };
  statutoryNssf: number;
  statutoryPaye: number;
  alertnessBonus: number;
  alertnessPenalty: number;
  alertnessMissed: number;
};

export type PayrollPortalReport = {
  from: string;
  to: string;
  company: PayrollPortalTenantPack;
  customer: PayrollPortalTenantPack;
  approvedNetPay: number;
  unapprovedSnapshots: number;
  dueAlertsOpen: number;
  notes: string[];
};

export const getPayrollPortalReport = (
  opts?: { from?: string; to?: string; token?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set('from', opts.from);
  if (opts?.to) qs.set('to', opts.to);
  const q = qs.toString();
  return coreFetch<PayrollPortalReport>(
    `/api/v1/payroll/reports${q ? `?${q}` : ''}`,
    { token: opts?.token },
  );
};

export const listPayrollCustomerOptions = (token?: string) =>
  coreFetch<Array<{ id: string; code: string; name: string }>>(
    '/api/v1/payroll/customer-options',
    { token },
  );

export const createPayrollCycle = (
  body: {
    periodStart: string;
    periodEnd: string;
    tenantType?: string;
    customerId?: string;
  },
  token?: string,
) =>
  coreFetch<PayrollCycle>('/api/v1/payroll/cycles', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const generatePayrollCycle = (id: string, token?: string) =>
  coreFetch<PayslipSnapshot[]>(`/api/v1/payroll/cycles/${id}/generate`, {
    method: 'POST',
    token,
  });

export const submitPayrollCycle = (id: string, token?: string) =>
  coreFetch<PayrollCycle>(`/api/v1/payroll/cycles/${id}/submit`, {
    method: 'POST',
    token,
  });

export const approvePayrollCycle = (id: string, token?: string) =>
  coreFetch<PayrollCycle>(`/api/v1/payroll/cycles/${id}/approve`, {
    method: 'POST',
    token,
  });

export const markPayrollPaid = (
  id: string,
  body: { paymentReference: string },
  token?: string,
) =>
  coreFetch<PayrollCycle>(`/api/v1/payroll/cycles/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listPayslips = (cycleId: string, token?: string) =>
  coreFetch<PayslipSnapshot[]>(
    `/api/v1/payroll/cycles/${cycleId}/payslips`,
    { token },
  );

export const getPayslip = (id: string, token?: string) =>
  coreFetch<PayslipSnapshot>(`/api/v1/payroll/payslips/${id}`, { token });

export type PayrollRegister = {
  cycle: PayrollCycle;
  headcount: number;
  totals: { grossPay: number; totalDeductions: number; netPay: number };
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    lines: PayslipSnapshot['calculationResult'] extends { lines?: infer L }
      ? L
      : never;
  }>;
};

export const getPayrollRegister = (cycleId: string, token?: string) =>
  coreFetch<PayrollRegister>(`/api/v1/payroll/cycles/${cycleId}/register`, {
    token,
  });

export const getPayrollLoanReport = (cycleId: string, token?: string) =>
  coreFetch<{
    cycleId: string;
    rowCount: number;
    totalDeductions: number;
    rows: Array<{
      employeeNumber: string;
      employeeName: string;
      loanCode: string;
      label: string;
      amount: number;
    }>;
  }>(`/api/v1/payroll/cycles/${cycleId}/reports/loan-deductions`, { token });

export const getPayrollStatutoryReport = (cycleId: string, token?: string) =>
  coreFetch<{
    cycleId: string;
    headcount: number;
    nssfTotal: number;
    payeTotal: number;
    rows: Array<{
      employeeNumber: string;
      employeeName: string;
      grossPay: number;
      nssf: number;
      paye: number;
    }>;
    note?: string;
  }>(`/api/v1/payroll/cycles/${cycleId}/reports/statutory`, { token });

export const getPayrollApprovalReport = (cycleId: string, token?: string) =>
  coreFetch<{
    cycle: PayrollCycle;
    approvalInstanceId?: string | null;
    createdBy: string;
    reviewedBy?: string | null;
    approvedBy?: string | null;
    paidAt?: string | null;
    paymentReference?: string | null;
    steps: Array<{
      stepOrder: number;
      decision: string;
      actorId: string;
      actedAt: string;
      remarks?: string | null;
    }>;
  }>(`/api/v1/payroll/cycles/${cycleId}/reports/approval`, { token });

export const exportPayrollBankFile = (cycleId: string, token?: string) =>
  coreFetch<{
    filename: string;
    contentType: string;
    csv: string;
    rows: unknown[];
  }>(`/api/v1/payroll/cycles/${cycleId}/export/bank-file`, { token });

export const exportPayrollMobileFile = (cycleId: string, token?: string) =>
  coreFetch<{
    filename: string;
    contentType: string;
    csv: string;
    rows: unknown[];
  }>(`/api/v1/payroll/cycles/${cycleId}/export/mobile-money-file`, { token });

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollBankFile(cycleId: string, token?: string) {
  const res = await exportPayrollBankFile(cycleId, token);
  downloadCsv(res.filename, res.csv);
  return res;
}

export async function downloadPayrollMobileFile(
  cycleId: string,
  token?: string,
) {
  const res = await exportPayrollMobileFile(cycleId, token);
  downloadCsv(res.filename, res.csv);
  return res;
}

export const listPayrollDueAlerts = (
  opts?: { customerId?: string; status?: string; token?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.customerId) qs.set('customerId', opts.customerId);
  if (opts?.status) qs.set('status', opts.status);
  const q = qs.toString();
  return coreFetch<PayrollDueAlert[]>(
    `/api/v1/payroll/due-alerts${q ? `?${q}` : ''}`,
    { token: opts?.token },
  );
};

export const scanPayrollDueAlerts = (force?: boolean, token?: string) =>
  coreFetch<{
    scanned: number;
    alertsCreated: number;
    notificationsQueued: number;
    skippedUnpaid: number;
    skippedAlreadyPaid: number;
  }>(`/api/v1/payroll/due-alerts/scan${force ? '?force=1' : ''}`, {
    method: 'POST',
    token,
  });

export const getPayrollInvoiceGate = (cycleId: string, token?: string) =>
  coreFetch<PayrollInvoiceGate>(
    `/api/v1/payroll/cycles/${cycleId}/invoice-gate`,
    { token },
  );

export const grantPayrollPayException = (
  cycleId: string,
  body?: { reason?: string },
  token?: string,
) =>
  coreFetch<PayrollInvoiceGate>(
    `/api/v1/payroll/cycles/${cycleId}/pay-exception`,
    {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      token,
    },
  );

// ── Procurement ──
export type Supplier = {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  tin?: string | null;
  vrn?: string | null;
  address?: string | null;
  category?: string;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountRef?: string | null;
  mobileMoneyProvider?: string | null;
  mobileMoneyRef?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string;
  rejectedReason?: string | null;
  createdBy?: string | null;
  createdAt?: string;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  lines?: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    receivedQty: number;
    stockItemId?: string | null;
  }[];
};

export const listSuppliers = (token?: string) =>
  coreFetch<Supplier[]>('/api/v1/procurement/suppliers', { token });

export const createSupplier = (
  body: {
    code: string;
    name: string;
    email?: string;
    phone?: string;
    tin?: string;
    vrn?: string;
    address?: string;
    category?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    bankName?: string;
    bankAccountRef?: string;
  },
  token?: string,
) =>
  coreFetch<Supplier>('/api/v1/procurement/suppliers', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const approveSupplier = (id: string, token?: string) =>
  coreFetch<Supplier>(`/api/v1/procurement/suppliers/${id}/approve`, {
    method: 'POST',
    token,
  });

export const rejectSupplier = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<Supplier>(`/api/v1/procurement/suppliers/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const suspendSupplier = (id: string, token?: string) =>
  coreFetch<Supplier>(`/api/v1/procurement/suppliers/${id}/suspend`, {
    method: 'POST',
    token,
  });

export type SupplierSubmission = {
  id: string;
  supplierId: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  referenceNumber: string;
  kind: string;
  status: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  currency: string;
  paymentStatus: string;
  rejectedReason?: string | null;
  paidAt?: string | null;
  createdBy: string;
  createdAt: string;
};

export const listSupplierSubmissions = (
  supplierId?: string,
  token?: string,
) => {
  const q = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : '';
  return coreFetch<SupplierSubmission[]>(
    `/api/v1/procurement/supplier-submissions${q}`,
    { token },
  );
};

export const approveSupplierSubmission = (id: string, token?: string) =>
  coreFetch<SupplierSubmission>(
    `/api/v1/procurement/supplier-submissions/${id}/approve`,
    { method: 'POST', token },
  );

export const rejectSupplierSubmission = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<SupplierSubmission>(
    `/api/v1/procurement/supplier-submissions/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      token,
    },
  );

export type SupplierMessage = {
  id: string;
  organizationId: string;
  supplierId: string;
  authorType: string;
  body: string;
  createdBy: string;
  authorName?: string | null;
  createdAt: string;
};

export const listSupplierMessages = (supplierId: string, token?: string) =>
  coreFetch<SupplierMessage[]>(
    `/api/v1/procurement/suppliers/${supplierId}/messages`,
    { token },
  );

export const createSupplierMessage = (
  supplierId: string,
  body: string,
  token?: string,
) =>
  coreFetch<SupplierMessage>(
    `/api/v1/procurement/suppliers/${supplierId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
      token,
    },
  );

export const markSupplierSubmissionPaid = (id: string, token?: string) =>
  coreFetch<SupplierSubmission>(
    `/api/v1/procurement/supplier-submissions/${id}/mark-paid`,
    { method: 'POST', token },
  );

export const listPurchaseOrders = (token?: string) =>
  coreFetch<PurchaseOrder[]>('/api/v1/procurement/purchase-orders', { token });

export const createPurchaseOrder = (
  body: {
    supplierId: string;
    poNumber: string;
    currency?: string;
    lines: { description: string; quantity: number; unitPrice: number }[];
  },
  token?: string,
) =>
  coreFetch<PurchaseOrder>('/api/v1/procurement/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const submitPurchaseOrder = (id: string, token?: string) =>
  coreFetch<PurchaseOrder>(
    `/api/v1/procurement/purchase-orders/${id}/submit`,
    { method: 'POST', token },
  );

export const approvePurchaseOrder = (id: string, token?: string) =>
  coreFetch<PurchaseOrder>(
    `/api/v1/procurement/purchase-orders/${id}/approve`,
    { method: 'POST', token },
  );

export type PurchaseRequest = {
  id: string;
  requestNumber: string;
  department: string;
  purpose: string;
  status: string;
  currency: string;
  awardedQuoteId?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  createdBy: string;
  createdAt: string;
  lines: {
    id: string;
    stockItemId?: string | null;
    stockSku?: string | null;
    description: string;
    quantity: number;
    unit: string;
  }[];
  quotes: {
    id: string;
    supplierId: string;
    supplierCode?: string | null;
    supplierName?: string | null;
    status: string;
    totalAmount: number;
    currency: string;
    createdBy: string;
    createdAt: string;
    lines: {
      id: string;
      purchaseRequestLineId: string;
      unitPrice: number;
      amount: number;
    }[];
  }[];
};

export const listPurchaseRequests = (token?: string) =>
  coreFetch<PurchaseRequest[]>('/api/v1/procurement/purchase-requests', {
    token,
  });

export const createPurchaseRequest = (
  body: {
    department: string;
    purpose: string;
    lines: {
      description: string;
      quantity: number;
      unit?: string;
      stockItemId?: string;
    }[];
  },
  token?: string,
) =>
  coreFetch<PurchaseRequest>('/api/v1/procurement/purchase-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const submitPurchaseRequest = (id: string, token?: string) =>
  coreFetch<PurchaseRequest>(
    `/api/v1/procurement/purchase-requests/${id}/submit`,
    { method: 'POST', token },
  );

export const approvePurchaseRequest = (id: string, token?: string) =>
  coreFetch<PurchaseRequest>(
    `/api/v1/procurement/purchase-requests/${id}/approve`,
    { method: 'POST', token },
  );

export const rejectPurchaseRequest = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<PurchaseRequest>(
    `/api/v1/procurement/purchase-requests/${id}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }), token },
  );

export const addPurchaseRequestQuote = (
  id: string,
  body: {
    supplierId: string;
    notes?: string;
    lines: { purchaseRequestLineId: string; unitPrice: number }[];
  },
  token?: string,
) =>
  coreFetch<PurchaseRequest>(
    `/api/v1/procurement/purchase-requests/${id}/quotes`,
    { method: 'POST', body: JSON.stringify(body), token },
  );

export const awardPurchaseRequestQuote = (
  id: string,
  quoteId: string,
  token?: string,
) =>
  coreFetch<PurchaseRequest>(
    `/api/v1/procurement/purchase-requests/${id}/quotes/${quoteId}/award`,
    { method: 'POST', token },
  );

export const convertPurchaseRequest = (id: string, token?: string) =>
  coreFetch<{ request: PurchaseRequest; purchaseOrder: PurchaseOrder }>(
    `/api/v1/procurement/purchase-requests/${id}/convert`,
    { method: 'POST', token },
  );

export const listReceivingQueue = (token?: string) =>
  coreFetch<PurchaseOrder[]>('/api/v1/procurement/receiving', { token });

export const createGoodsReceipt = (
  poId: string,
  body: {
    lines: { purchaseOrderLineId: string; quantityReceived: number }[];
    notes?: string;
  },
  token?: string,
) =>
  coreFetch(`/api/v1/procurement/receiving/${poId}/goods-receipts`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export type StockItem = {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  unit: string;
  reorderLevel?: number | null;
  isActive: boolean;
  onHand: number;
  belowReorder: boolean;
  createdAt: string;
};

export const listStockItems = (token?: string) =>
  coreFetch<StockItem[]>('/api/v1/inventory/items', { token });

export const listStockAlerts = (token?: string) =>
  coreFetch<StockItem[]>('/api/v1/inventory/alerts', { token });

export type StockCategoryOption = { code: string; label: string };

export const listStockCategoryOptions = (token?: string) =>
  coreFetch<StockCategoryOption[]>('/api/v1/inventory/category-options', {
    token,
  });

export type InventoryReport = {
  itemsTotal: number;
  itemsActive: number;
  belowReorder: number;
  onHandUnits: number;
  byCategory: { category: string; items: number; onHand: number }[];
  notes: string[];
};

export const getInventoryReports = (token?: string) =>
  coreFetch<InventoryReport>('/api/v1/inventory/reports', { token });

export type ProcurementReport = {
  suppliersTotal: number;
  suppliersPending: number;
  suppliersApproved: number;
  purchaseRequestsTotal: number;
  purchaseRequestsPendingApproval: number;
  purchaseRequestsApproved: number;
  purchaseOrdersOpen: number;
  purchaseOrdersReceived: number;
  goodsReceiptsTotal: number;
  submissionsUnpaid: number;
  purchaseRequestsByStatus: { status: string; count: number }[];
  purchaseOrdersByStatus: { status: string; count: number }[];
  notes: string[];
};

export const getProcurementReports = (token?: string) =>
  coreFetch<ProcurementReport>('/api/v1/procurement/reports', { token });

export const createStockItem = (
  body: {
    sku: string;
    name: string;
    category?: string;
    unit?: string;
    reorderLevel?: number;
  },
  token?: string,
) =>
  coreFetch<StockItem>('/api/v1/inventory/items', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateStockItem = (
  id: string,
  body: { reorderLevel?: number | null; category?: string; name?: string },
  token?: string,
) =>
  coreFetch<StockItem>(`/api/v1/inventory/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const recordStockMovement = (
  body: {
    stockItemId: string;
    movementType: 'IN' | 'OUT' | 'ADJUST';
    quantity: number;
    notes?: string;
  },
  token?: string,
) =>
  coreFetch('/api/v1/inventory/movements', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Visitors / call centre ──
/** Module 12-D — visitor ID document type */
export type VisitorIdType =
  | 'NIDA'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'OTHER';

export type VisitorAppointment = {
  id: string;
  referenceNumber: string;
  visitorName: string;
  visitorEmail?: string | null;
  companyName?: string | null;
  hostName?: string | null;
  purpose: string;
  visitKind?: string | null;
  vehiclePlate?: string | null;
  /** Module 12-D */
  idType?: VisitorIdType | null;
  idNumber?: string | null;
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  status: string;
  validFrom: string;
  validUntil: string;
  createdAt: string;
};

export type VisitorEntry = {
  id: string;
  visitorName: string;
  result: string;
  /** Module 12-B — IN (entry) or OUT (exit) */
  direction?: 'IN' | 'OUT' | string;
  siteId: string;
  recordedAt: string;
  denyReason?: string | null;
  /** Module 12-D — from linked appointment when present */
  idType?: VisitorIdType | null;
  idNumber?: string | null;
};

export type GateExitBody = {
  siteId: string;
  gateId?: string;
  clientEventId?: string;
  appointmentId?: string;
  referenceNumber?: string;
  verificationCode?: string;
  entryId?: string;
};

export type GateExitResponse = {
  allowed: boolean;
  exited: boolean;
  result: string;
  entry: VisitorEntry;
};

/** Module 12-E — host channels queued on gate deny */
export type GateDenyHostNotified = {
  sms?: boolean;
  email?: boolean;
};

export type GateVerifyResponse = {
  allowed: boolean;
  result: string;
  entry: VisitorEntry;
  /** Module 12-A */
  fieldAlertId?: string | null;
  /** Module 12-E — null when no appointment / allow / replay */
  hostNotified?: GateDenyHostNotified | null;
  idType?: VisitorIdType | null;
  idNumber?: string | null;
};

export const listVisitorAppointments = (
  params?: { status?: string },
  token?: string,
) => {
  const q = params?.status ? `?status=${params.status}` : '';
  return coreFetch<VisitorAppointment[]>(
    `/api/v1/visitors/appointments${q}`,
    { token },
  );
};

export const approveVisitorAppointment = (id: string, token?: string) =>
  coreFetch<{
    appointment: VisitorAppointment;
    verificationCode: string;
    validUntil: string;
    siteId?: string;
    gateId?: string | null;
    /** Module 12-C — channels queued (see GateCodeDelivery in customer.ts) */
    delivery?: {
      email?: boolean;
      sms?: boolean;
      whatsapp?: boolean;
    };
  }>(`/api/v1/visitors/appointments/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export const rejectVisitorAppointment = (
  id: string,
  body: { reason: string },
  token?: string,
) =>
  coreFetch<VisitorAppointment>(
    `/api/v1/visitors/appointments/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

export const listVisitorEntries = (token?: string) =>
  coreFetch<VisitorEntry[]>('/api/v1/visitors/entries', { token });

/** Module 12-B — gate exit punch (staff visitors.manage). */
export const gateExit = (body: GateExitBody, token?: string) =>
  coreFetch<GateExitResponse>('/api/v1/visitors/gate/exit', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Device integration ──
export const DEVICE_TYPES = [
  'FINGERPRINT_SCANNER',
  'BIOMETRIC_TERMINAL',
  'FACE_TERMINAL',
  'QR_SCANNER',
  'BARCODE_SCANNER',
  'PRINTER',
  'RFID_READER',
  'SMART_CARD_READER',
  'CCTV_CAMERA',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_CONNECTIONS = ['USB', 'SERIAL', 'NETWORK', 'MQTT', 'ONVIF'] as const;
export type DeviceConnection = (typeof DEVICE_CONNECTIONS)[number];

export const DEVICE_COMMAND_TYPES = [
  'ENROLL_FINGERPRINT',
  'ENROLL_FACE',
  'ENROLL_CARD',
  'DELETE_USER',
  'SYNC_USERS',
  'PRINT',
  'OPEN_GATE',
  'REBOOT',
] as const;
export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[number];

export type EdgeGateway = {
  id: string;
  code: string;
  name: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  status: string;
  version?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  apiKey?: string;
};

export type Device = {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  connection: DeviceConnection;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  gateId?: string | null;
  edgeGatewayId?: string | null;
  status: string;
  vendor?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  /** Camera stream/embed/snapshot URLs, NVR zone, etc. — never Nest-proxied video. */
  config?: Record<string, unknown> | null;
  lastSeenAt?: string | null;
  createdAt: string;
  apiKey?: string;
};

export type DeviceEvent = {
  id: string;
  organizationId: string;
  deviceId: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  routedTo?: string | null;
  error?: string | null;
  capturedAt: string;
  receivedAt: string;
  processedAt?: string | null;
};

export type DeviceDetail = Device & {
  eventCount: number;
  pendingCommands: number;
};

export type DeviceCommand = {
  id: string;
  deviceId: string;
  type: DeviceCommandType;
  status: string;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  issuedAt?: string;
  dispatchedAt?: string | null;
  acknowledgedAt?: string | null;
  expiresAt?: string | null;
};

export const listDevices = (
  filters?: { type?: string; siteId?: string; status?: string },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (filters?.type) q.set('type', filters.type);
  if (filters?.siteId) q.set('siteId', filters.siteId);
  if (filters?.status) q.set('status', filters.status);
  const qs = q.toString();
  return coreFetch<Device[]>(`/api/v1/devices${qs ? `?${qs}` : ''}`, { token });
};

export const getDevice = (id: string, token?: string) =>
  coreFetch<DeviceDetail>(`/api/v1/devices/${id}`, { token });

export const registerDevice = (
  body: {
    code: string;
    name: string;
    type: DeviceType;
    connection: DeviceConnection;
    siteId?: string;
    gateId?: string;
    edgeGatewayId?: string;
    vendor?: string;
    model?: string;
    serialNumber?: string;
    directPush?: boolean;
    config?: Record<string, unknown>;
  },
  token?: string,
) =>
  coreFetch<Device>('/api/v1/devices', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateDevice = (
  id: string,
  body: {
    name?: string;
    status?: string;
    siteId?: string;
    gateId?: string;
    config?: Record<string, unknown>;
  },
  token?: string,
) =>
  coreFetch<Device>(`/api/v1/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const listGateways = (token?: string) =>
  coreFetch<EdgeGateway[]>('/api/v1/devices/gateways', { token });

export const registerGateway = (
  body: { code: string; name: string; siteId?: string; version?: string },
  token?: string,
) =>
  coreFetch<EdgeGateway>('/api/v1/devices/gateways', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Module 28-A — acknowledge an open CCTV AI alert (RECEIVED → PROCESSED). */
export const acknowledgeCctvEvent = (
  id: string,
  body?: { note?: string },
  token?: string,
) =>
  coreFetch<DeviceEvent>(`/api/v1/devices/events/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

/** Module 28-A — record an incident (category CCTV_ALERT) from a CCTV alert. */
export const createIncidentFromCctvEvent = (
  id: string,
  body?: { severity?: string; title?: string; description?: string },
  token?: string,
) =>
  coreFetch<{
    incident: { id: string; incidentNumber: string; siteId: string };
    event: DeviceEvent;
  }>(`/api/v1/devices/events/${id}/create-incident`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

/** GET /devices/events — may 404 until backend lands; callers should catch. */
export const listDeviceEvents = (
  filters?: { type?: string; deviceId?: string; limit?: number },
  token?: string,
) => {
  const q = new URLSearchParams();
  if (filters?.type) q.set('type', filters.type);
  if (filters?.deviceId) q.set('deviceId', filters.deviceId);
  if (filters?.limit != null) q.set('limit', String(filters.limit));
  const qs = q.toString();
  return coreFetch<DeviceEvent[]>(
    `/api/v1/devices/events${qs ? `?${qs}` : ''}`,
    { token },
  );
};

export const listDeviceCommands = (deviceId: string, token?: string) =>
  coreFetch<DeviceCommand[]>(`/api/v1/devices/${deviceId}/commands`, { token });

export const issueDeviceCommand = (
  deviceId: string,
  body: {
    type: DeviceCommandType;
    payload?: Record<string, unknown>;
    expiresInSeconds?: number;
  },
  token?: string,
) =>
  coreFetch<DeviceCommand>(`/api/v1/devices/${deviceId}/commands`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export type StaffServiceRequest = {
  id: string;
  customerId: string;
  referenceNumber: string;
  category: string;
  urgency: string;
  status: string;
  title: string;
  description: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  callbackPhone?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  customerCode?: string | null;
  customerName?: string | null;
  incidentId?: string | null;
  incidentNumber?: string | null;
};

/** GET /customers/service-requests — call centre / commercial */
export const listStaffServiceRequests = (token?: string) =>
  coreFetch<StaffServiceRequest[]>('/api/v1/customers/service-requests', {
    token,
  });

/** PATCH /customers/service-requests/:id */
export const updateStaffServiceRequest = (
  id: string,
  body: { status: string; resolutionNotes?: string },
  token?: string,
) =>
  coreFetch<StaffServiceRequest>(`/api/v1/customers/service-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

/** Module 6-B — staff complaints */
export type StaffComplaint = {
  id: string;
  customerId: string;
  referenceNumber: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  callbackPhone?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  customerCode?: string | null;
  customerName?: string | null;
};

export const listStaffComplaints = (token?: string) =>
  coreFetch<StaffComplaint[]>('/api/v1/customers/complaints', { token });

export const updateStaffComplaint = (
  id: string,
  body: { status: string; resolutionNotes?: string },
  token?: string,
) =>
  coreFetch<StaffComplaint>(`/api/v1/customers/complaints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const createStaffComplaint = (
  body: {
    customerId: string;
    category: string;
    severity?: string;
    title: string;
    description: string;
    siteId?: string;
    callbackPhone?: string;
  },
  token?: string,
) =>
  coreFetch<StaffComplaint>('/api/v1/customers/complaints', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** Portal 35.19 — marketing / BD pipeline (`marketing.manage`). */
export type MarketingReport = {
  byStage: Record<string, number>;
  openPipeline: number;
  won: number;
  lost: number;
  activeCampaigns: number;
  surveysScheduled: number;
  quotesSent: number;
  pendingCommissions: number;
  pendingCommissionAmount: number;
  generatedAt: string;
  notes: string[];
};

export type MarketingCampaign = {
  id: string;
  code: string;
  name: string;
  channel: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
};

export type MarketingLead = {
  id: string;
  code: string;
  companyName: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source: string;
  stage: string;
  campaignId?: string | null;
  campaignCode?: string | null;
  campaignName?: string | null;
  referrerName?: string | null;
  referrerType?: string | null;
  ownerName?: string | null;
  estimatedValue?: number | null;
  currency: string;
  notes?: string | null;
  lostReason?: string | null;
  customerId?: string | null;
  customerCode?: string | null;
  contractId?: string | null;
  contractNumber?: string | null;
  createdAt: string;
  allowedNextStages: string[];
};

export type MarketingSurvey = {
  id: string;
  siteAddress: string;
  scheduledAt: string;
  completedAt?: string | null;
  status: string;
  outcome?: string | null;
  officerName?: string | null;
};

export type MarketingQuote = {
  id: string;
  quoteNumber: string;
  kind: string;
  status: string;
  amount: number;
  currency: string;
  allowedNextStatuses: string[];
};

export type MarketingCommission = {
  id: string;
  leadId: string;
  beneficiary: string;
  amount: number;
  currency: string;
  status: string;
  leadCode?: string;
  companyName?: string;
};

export type MarketingLeadDetail = MarketingLead & {
  surveys: MarketingSurvey[];
  quotes: MarketingQuote[];
  commissions: MarketingCommission[];
};

export const getMarketingReports = (token?: string) =>
  coreFetch<MarketingReport>('/api/v1/marketing/reports', { token });

export const getMarketingOptions = (token?: string) =>
  coreFetch<{
    channels: string[];
    sources: string[];
    stages: string[];
    referrerTypes: string[];
    quoteKinds: string[];
  }>('/api/v1/marketing/options', { token });

export const listMarketingCampaigns = (token?: string) =>
  coreFetch<MarketingCampaign[]>('/api/v1/marketing/campaigns', { token });

export const createMarketingCampaign = (
  body: { name: string; channel?: string; notes?: string; code?: string },
  token?: string,
) =>
  coreFetch<MarketingCampaign>('/api/v1/marketing/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const updateMarketingCampaign = (
  id: string,
  body: { isActive?: boolean; name?: string },
  token?: string,
) =>
  coreFetch<MarketingCampaign>(`/api/v1/marketing/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const listMarketingLeads = (
  opts?: { stage?: string; source?: string; token?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.stage) qs.set('stage', opts.stage);
  if (opts?.source) qs.set('source', opts.source);
  const q = qs.toString();
  return coreFetch<MarketingLead[]>(
    `/api/v1/marketing/leads${q ? `?${q}` : ''}`,
    { token: opts?.token },
  );
};

export const getMarketingLead = (id: string, token?: string) =>
  coreFetch<MarketingLeadDetail>(`/api/v1/marketing/leads/${id}`, { token });

export const createMarketingLead = (
  body: {
    companyName: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    source?: string;
    campaignId?: string;
    referrerName?: string;
    referrerType?: string;
    estimatedValue?: number;
    notes?: string;
  },
  token?: string,
) =>
  coreFetch<MarketingLeadDetail>('/api/v1/marketing/leads', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const patchMarketingLead = (
  id: string,
  body: { stage?: string; notes?: string },
  token?: string,
) =>
  coreFetch<MarketingLeadDetail>(`/api/v1/marketing/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const winMarketingLead = (
  id: string,
  body?: { commissionAmount?: number; commissionBeneficiary?: string },
  token?: string,
) =>
  coreFetch<MarketingLeadDetail>(`/api/v1/marketing/leads/${id}/win`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    token,
  });

export const loseMarketingLead = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<MarketingLeadDetail>(`/api/v1/marketing/leads/${id}/lose`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const createMarketingSurvey = (
  leadId: string,
  body: { siteAddress: string; scheduledAt: string; officerName?: string },
  token?: string,
) =>
  coreFetch<MarketingSurvey>(`/api/v1/marketing/leads/${leadId}/surveys`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const completeMarketingSurvey = (
  leadId: string,
  surveyId: string,
  outcome: string,
  token?: string,
) =>
  coreFetch<MarketingSurvey>(
    `/api/v1/marketing/leads/${leadId}/surveys/${surveyId}/complete`,
    { method: 'POST', body: JSON.stringify({ outcome }), token },
  );

export const createMarketingQuote = (
  leadId: string,
  body: {
    kind: string;
    amount: number;
    validUntil?: string;
    serviceTypes?: string[];
  },
  token?: string,
) =>
  coreFetch<MarketingQuote>(`/api/v1/marketing/leads/${leadId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const patchMarketingQuote = (
  leadId: string,
  quoteId: string,
  status: string,
  token?: string,
) =>
  coreFetch<MarketingQuote>(
    `/api/v1/marketing/leads/${leadId}/quotes/${quoteId}`,
    { method: 'PATCH', body: JSON.stringify({ status }), token },
  );

export const convertMarketingCustomer = (leadId: string, token?: string) =>
  coreFetch<MarketingLeadDetail>(
    `/api/v1/marketing/leads/${leadId}/convert-customer`,
    { method: 'POST', body: JSON.stringify({}), token },
  );

export const convertMarketingContract = (
  leadId: string,
  body: {
    startDate: string;
    endDate: string;
    monthlyFee: number;
    serviceTypes: string[];
    title?: string;
  },
  token?: string,
) =>
  coreFetch<MarketingLeadDetail>(
    `/api/v1/marketing/leads/${leadId}/convert-contract`,
    { method: 'POST', body: JSON.stringify(body), token },
  );

export const listMarketingCommissions = (token?: string) =>
  coreFetch<MarketingCommission[]>('/api/v1/marketing/commissions', { token });

export const accrueMarketingCommission = (id: string, token?: string) =>
  coreFetch<MarketingCommission>(`/api/v1/marketing/commissions/${id}/accrue`, {
    method: 'POST',
    body: JSON.stringify({}),
    token,
  });

export type CallCentreReport = {
  openTickets: number;
  openComplaints: number;
  pendingVisitorAppointments: number;
  gateEntriesToday: number;
  ticketsByCategory: Record<string, number>;
  parkingInquiries: number;
  supplierInquiries: number;
  payrollInquiries: number;
  generatedAt: string;
  notes: string[];
};

export type SupportCustomerOption = { id: string; code: string; name: string };

export const getCallCentreReports = (token?: string) =>
  coreFetch<CallCentreReport>('/api/v1/callcentre/reports', { token });

export const getCallCentreTicketOptions = (token?: string) =>
  coreFetch<{ categories: string[]; notes: string[] }>(
    '/api/v1/callcentre/ticket-options',
    { token },
  );

export const listCallCentreCustomerOptions = (token?: string) =>
  coreFetch<SupportCustomerOption[]>('/api/v1/callcentre/customer-options', {
    token,
  });

export const createCallCentreTicket = (
  body: {
    customerId: string;
    category: string;
    title: string;
    description: string;
    urgency?: string;
    siteId?: string;
    callbackPhone?: string;
  },
  token?: string,
) =>
  coreFetch<StaffServiceRequest>('/api/v1/callcentre/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const escalateCallCentreTicket = (id: string, token?: string) =>
  coreFetch<{ incidentId: string; incidentNumber: string }>(
    `/api/v1/callcentre/tickets/${id}/escalate-incident`,
    { method: 'POST', body: JSON.stringify({}), token },
  );

export type CctvReport = {
  camerasTotal: number;
  camerasOnline: number;
  openAiAlerts: number;
  anprToday: number;
  parkingDenies24h: number;
  visitorDenies24h: number;
  openHighFieldAlerts: number;
  openCctvAlertIncidents: number;
  generatedAt: string;
  notes: string[];
};

export type CctvSiteRow = {
  id: string;
  siteId: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

export type CctvParkingMonitor = {
  occupancy: {
    occupied: number;
    spacesActive: number;
    utilizationPct: number | null;
  };
  entries: (CctvSiteRow & {
    plateNumber: string;
    direction: string;
    decision: string;
    recordedAt: string;
  })[];
  openViolations: (CctvSiteRow & {
    plateNumber: string;
    violationType: string;
    status: string;
    createdAt: string;
  })[];
  patrolObservations: (CctvSiteRow & {
    parkingArea: string;
    observationType: string;
    plateNumber: string | null;
    inspectedAt: string;
  })[];
  notes: string[];
};

export type CctvAccessMonitor = {
  checkIns24h: number;
  checkOuts24h: number;
  visitorDenies24h: number;
  accessEntries: (CctvSiteRow & {
    employeeId: string;
    entryType: string;
    accessMethod: string;
    recordedAt: string;
  })[];
  visitorDenies: (CctvSiteRow & {
    visitorName: string;
    result: string;
    denyReason: string | null;
    direction: string;
    recordedAt: string;
  })[];
  notes: string[];
};

export type CctvPatrolMonitor = {
  scans: (CctvSiteRow & {
    guardId: string;
    checkpointId: string;
    method: string;
    scannedAt: string;
    remarks: string | null;
  })[];
  missedPatrols: (CctvSiteRow & {
    alertType: string;
    severity: string;
    message: string;
    escalationStage: string;
    createdAt: string;
  })[];
  notes: string[];
};

export type CctvAlarmMonitor = {
  fieldAlarms: (CctvSiteRow & {
    alertType: string;
    severity: string;
    message: string;
    escalationStage: string;
    createdAt: string;
  })[];
  failedCameraEvents: {
    id: string;
    deviceId: string;
    status: string;
    error: string | null;
    receivedAt: string;
  }[];
  notes: string[];
};

export type CctvIncidentMonitor = {
  rows: (CctvSiteRow & {
    incidentNumber: string;
    category: string;
    severity: string;
    status: string;
    title: string;
    occurredAt: string;
    createdAt: string;
  })[];
  notes: string[];
};

export const getCctvReports = (token?: string) =>
  coreFetch<CctvReport>('/api/v1/cctv/reports', { token });

export const getCctvParkingMonitor = (token?: string) =>
  coreFetch<CctvParkingMonitor>('/api/v1/cctv/parking-monitor', { token });

export const getCctvAccessMonitor = (token?: string) =>
  coreFetch<CctvAccessMonitor>('/api/v1/cctv/access-monitor', { token });

export const getCctvPatrolMonitor = (token?: string) =>
  coreFetch<CctvPatrolMonitor>('/api/v1/cctv/patrol-monitor', { token });

export const getCctvAlarmMonitor = (token?: string) =>
  coreFetch<CctvAlarmMonitor>('/api/v1/cctv/alarm-monitor', { token });

export const getCctvIncidentMonitor = (token?: string) =>
  coreFetch<CctvIncidentMonitor>('/api/v1/cctv/incident-monitor', { token });



