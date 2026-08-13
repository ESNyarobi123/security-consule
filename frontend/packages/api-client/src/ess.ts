/**
 * Employee Self-Service (§35.5) — admin-web `/ess`.
 * Self-scoped only (`ess.access`). Never call org-wide HR/payroll list APIs.
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

export type EssProfile = {
  id: string;
  organizationId: string;
  employeeNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  employmentType: string;
  status: string;
  hireDate?: string | null;
  guardProfileId?: string | null;
};

export type EssLeaveType = {
  id: string;
  code: string;
  name: string;
  annualQuotaDays: number;
  isActive: boolean;
};

export type EssLeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  createdBy?: string | null;
  createdAt: string;
};

export type EssPayslip = {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  createdAt: string;
};

export type EssLoan = {
  id: string;
  loanNumber: string;
  loanType?: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  status: string;
  purpose?: string | null;
  itemName?: string | null;
  supplierName?: string | null;
  itemCost?: number | null;
  issuedAt?: string | null;
  employeeAcknowledgedAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
};

export type EssLoanStatement = {
  loan: {
    id: string;
    loanNumber: string;
    loanType: string;
    status: string;
    principalAmount: number;
    monthlyInstallment: number;
    termMonths: number;
    itemName?: string | null;
    employeeAcknowledgedAt?: string | null;
    settledAt?: string | null;
  };
  installments: Array<{
    installmentNumber: number;
    dueDate: string;
    amountDue: number;
    amountPaid: number;
    status: string;
    paidAt?: string | null;
  }>;
  totalDue: number;
  totalPaid: number;
  outstandingBalance: number;
  isSettled: boolean;
};

export type EssEquipment = {
  assignmentId: string;
  assetId: string;
  assetTag: string;
  name: string;
  category?: string | null;
  assignedAt: string;
  notes?: string | null;
  /** ASSIGNED | RETURN_REQUESTED (awaiting storekeeper confirm). */
  status?: 'ASSIGNED' | 'RETURN_REQUESTED' | string;
  returnRequestedAt?: string | null;
};

export const getEssMe = (token?: string) =>
  coreFetch<EssProfile>('/api/v1/ess/me', { token });

export const listEssLeaveTypes = (token?: string) =>
  coreFetch<EssLeaveType[]>('/api/v1/ess/leave/types', { token });

export const listEssLeaveRequests = (token?: string) =>
  coreFetch<EssLeaveRequest[]>('/api/v1/ess/leave/requests', { token });

export const applyEssLeave = (
  body: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  },
  token?: string,
) =>
  coreFetch<EssLeaveRequest>('/api/v1/ess/leave/requests', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listEssPayslips = (token?: string) =>
  coreFetch<EssPayslip[]>('/api/v1/ess/payslips', { token });

export const getEssPayslip = (id: string, token?: string) =>
  coreFetch<EssPayslip>(`/api/v1/ess/payslips/${id}`, { token });

export const listEssLoans = (token?: string) =>
  coreFetch<EssLoan[]>('/api/v1/ess/loans', { token });

export const applyEssLoan = (
  body: {
    loanType: string;
    principalAmount: number;
    termMonths: number;
    interestRate?: number;
    purpose?: string;
    itemName?: string;
  },
  token?: string,
) =>
  coreFetch<EssLoan>('/api/v1/ess/loans', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const getEssLoanStatement = (id: string, token?: string) =>
  coreFetch<EssLoanStatement>(`/api/v1/ess/loans/${id}/statement`, { token });

export const acknowledgeEssLoan = (id: string, token?: string) =>
  coreFetch<{ employeeAcknowledgedAt: string }>(
    `/api/v1/ess/loans/${id}/acknowledge`,
    { method: 'POST', body: '{}', token },
  );

export const listEssEquipment = (token?: string) =>
  coreFetch<EssEquipment[]>('/api/v1/ess/equipment', { token });

export const returnEssEquipment = (assignmentId: string, token?: string) =>
  coreFetch<EssEquipment>(
    `/api/v1/ess/equipment/${assignmentId}/return`,
    { method: 'POST', body: '{}', token },
  );

export type EssPettyCashVoucher = {
  id: string;
  organizationId: string;
  fundId: string;
  fundName?: string | null;
  voucherNumber: string;
  amount: number;
  purpose: string;
  category: string;
  status: string;
  receiptUrl?: string | null;
  approvalInstanceId?: string | null;
  approvedBy?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
  reimbursedAt?: string | null;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  department?: string | null;
  createdBy: string;
  createdAt: string;
};

export const listEssPettyCash = (token?: string) =>
  coreFetch<EssPettyCashVoucher[]>('/api/v1/ess/petty-cash', { token });

export const applyEssPettyCash = (
  body: {
    amount: number;
    purpose: string;
    category: string;
    receiptUrl?: string;
    branchId?: string;
    department?: string;
  },
  token?: string,
) =>
  coreFetch<EssPettyCashVoucher>('/api/v1/ess/petty-cash', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export type EssRequestKind = 'LEAVE' | 'LOAN' | 'MOVEMENT' | 'PETTY_CASH';

export type EssRequestItem = {
  kind: EssRequestKind | string;
  id: string;
  title: string;
  status: string;
  createdAt: string;
  detail?: string | null;
  href?: string | null;
};

export const listEssRequests = (token?: string) =>
  coreFetch<EssRequestItem[]>('/api/v1/ess/requests', { token });
