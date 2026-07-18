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
export type Customer = {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
};

export const listCustomers = (token?: string) =>
  coreFetch<Customer[]>('/api/v1/customers', { token });

export const createCustomer = (
  body: { code: string; name: string; email?: string; phone?: string },
  token?: string,
) =>
  coreFetch<Customer>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// ── Contracts ──
export type Contract = {
  id: string;
  customerId: string;
  contractNumber: string;
  title: string;
  serviceType: string;
  status: string;
  monthlyFee: string;
  currency: string;
  startDate: string;
  endDate: string;
};

export const listContracts = (token?: string) =>
  coreFetch<Contract[]>('/api/v1/contracts', { token });

export const createContract = (
  body: {
    customerId: string;
    contractNumber: string;
    title: string;
    serviceType: string;
    startDate: string;
    endDate: string;
    monthlyFee: number;
  },
  token?: string,
) =>
  coreFetch<Contract>('/api/v1/contracts', {
    method: 'POST',
    body: JSON.stringify(body),
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

// ── Guards ──
export type Guard = {
  id: string;
  employeeNumber: string;
  status: string;
  deploymentEligible: boolean;
  userId: string;
};

export const listGuards = (token?: string) =>
  coreFetch<Guard[]>('/api/v1/guards', { token });

export const updateGuardStatus = (
  id: string,
  status: string,
  token?: string,
) =>
  coreFetch<Guard>(`/api/v1/guards/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  });

// ── Finance ──
export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
};

export const listInvoices = (token?: string) =>
  coreFetch<Invoice[]>('/api/v1/finance/invoices', { token });

export const sendInvoice = (id: string, token?: string) =>
  coreFetch<Invoice>(`/api/v1/finance/invoices/${id}/send`, {
    method: 'POST',
    token,
  });

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

// ── HR ──
export type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email?: string | null;
  status: string;
  department?: string | null;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  status: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
};

export const listEmployees = (token?: string) =>
  coreFetch<Employee[]>('/api/v1/hr/employees', { token });

export const listLeaveRequests = (token?: string) =>
  coreFetch<LeaveRequest[]>('/api/v1/hr/leave/requests', { token });

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
  action: string;
  resourceType: string;
  resourceId?: string | null;
  createdAt: string;
};

export const listAuditLogs = (take = 20, token?: string) =>
  coreFetch<AuditLog[]>(`/api/v1/audit/logs?take=${take}`, { token });

// ── Health ──
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
