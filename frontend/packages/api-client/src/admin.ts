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

export type UpdateCustomerBody = Partial<
  Omit<
    CreateCustomerBody,
    | 'code'
    | 'saveAsDraft'
    | 'tin'
    | 'email'
    | 'phone'
    | 'address'
    | 'contactPerson'
    | 'contactDesignation'
    | 'city'
    | 'billingEmail'
  >
> & {
  tin?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  contactDesignation?: string | null;
  city?: string | null;
  billingEmail?: string | null;
  isActive?: boolean;
};

export const listCustomers = (token?: string) =>
  coreFetch<Customer[]>('/api/v1/customers', { token });

export const getCustomer = (id: string, token?: string) =>
  coreFetch<Customer>(`/api/v1/customers/${id}`, { token });

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

export type Guard = {
  id: string;
  employeeNumber: string;
  status: string;
  deploymentEligible: boolean;
  /** G3 thin readiness checklist */
  trainingCompleted?: boolean;
  firearmAuthorized?: boolean;
  firearmExpiry?: string | null;
  clearanceVerified?: boolean;
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
  options?: { deploymentEligible?: boolean; token?: string },
) => {
  const row = await coreFetch<GuardApiRow>(`/api/v1/guards/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(options?.deploymentEligible !== undefined
        ? { deploymentEligible: options.deploymentEligible }
        : {}),
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

export type InvoiceScanOverdueResult = {
  markedOverdue: number;
  invoiceNumbers: string[];
};

export const scanOverdueInvoices = (token?: string) =>
  coreFetch<InvoiceScanOverdueResult>(
    '/api/v1/finance/invoices/scan-overdue',
    { method: 'POST', token },
  );

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
  code: string;
  name: string;
  isActive: boolean;
};

export const listBranches = (token?: string) =>
  coreFetch<Branch[]>('/api/v1/enterprise/branches', { token });

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
};

export const listApprovalInstances = (token?: string) =>
  coreFetch<ApprovalInstance[]>('/api/v1/approvals/instances', { token });

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
  createdAt: string;
};

export type PayslipSnapshot = {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  ruleVersionId: string;
  createdAt: string;
};

export const listPayrollCycles = (token?: string) =>
  coreFetch<PayrollCycle[]>('/api/v1/payroll/cycles', { token });

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

// ── Procurement ──
export type Supplier = {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

export const listSuppliers = (token?: string) =>
  coreFetch<Supplier[]>('/api/v1/procurement/suppliers', { token });

export const createSupplier = (
  body: { code: string; name: string; email?: string; phone?: string },
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

// ── Visitors / call centre ──
export type VisitorAppointment = {
  id: string;
  referenceNumber: string;
  visitorName: string;
  hostName?: string | null;
  purpose: string;
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
  siteId: string;
  recordedAt: string;
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
