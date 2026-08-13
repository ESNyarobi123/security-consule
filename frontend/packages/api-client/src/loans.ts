/**
 * Employee Loans admin (§17 / portal §35.16) — admin-web `/loans`.
 * Permission: `loans.manage`. ESS self-apply stays on `/ess/loans`.
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

export type LoanType =
  | 'SECURITY_BOOTS'
  | 'SMARTPHONE'
  | 'CASH'
  | 'UNIFORM'
  | 'EMERGENCY'
  | 'SALARY_ADVANCE'
  | 'EQUIPMENT'
  | 'TRANSPORT_SUPPORT'
  | 'MEDICAL_SUPPORT'
  | 'OTHER';

export const LOAN_TYPE_OPTIONS: Array<{
  value: LoanType;
  label: string;
  isItemLoan: boolean;
}> = [
  { value: 'SECURITY_BOOTS', label: 'Security boots loan', isItemLoan: true },
  { value: 'SMARTPHONE', label: 'Smartphone loan', isItemLoan: true },
  { value: 'CASH', label: 'Cash / money loan', isItemLoan: false },
  { value: 'UNIFORM', label: 'Uniform loan', isItemLoan: true },
  { value: 'EMERGENCY', label: 'Emergency loan', isItemLoan: false },
  { value: 'SALARY_ADVANCE', label: 'Salary advance', isItemLoan: false },
  { value: 'EQUIPMENT', label: 'Equipment loan', isItemLoan: true },
  { value: 'TRANSPORT_SUPPORT', label: 'Transport support loan', isItemLoan: false },
  { value: 'MEDICAL_SUPPORT', label: 'Medical support loan', isItemLoan: false },
  { value: 'OTHER', label: 'Other approved support loan', isItemLoan: false },
];

export function isItemLoanType(t: string) {
  return LOAN_TYPE_OPTIONS.some((o) => o.value === t && o.isItemLoan);
}

export type LoanStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type EmployeeLoan = {
  id: string;
  organizationId: string;
  employeeId: string;
  loanNumber: string;
  loanType: LoanType | string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  status: LoanStatus | string;
  purpose?: string | null;
  itemName?: string | null;
  supplierName?: string | null;
  itemCost?: number | null;
  approvalInstanceId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
  employeeAcknowledgedAt?: string | null;
  disbursedAt?: string | null;
  settledAt?: string | null;
  clearedBy?: string | null;
  outstandingBalance?: number | null;
  /** Present when API exposes creator — used for UI creator≠approver guard. */
  createdBy?: string | null;
  createdAt: string;
};

export type LoanInstallment = {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  payslipSnapshotId?: string | null;
  paidAt?: string | null;
};

export type LoanStatement = {
  loan: EmployeeLoan;
  installments: LoanInstallment[];
  totalDue: number;
  totalPaid: number;
  outstandingBalance: number;
  isSettled: boolean;
};

export type CreateLoanBody = {
  employeeId: string;
  loanType: LoanType;
  principalAmount: number;
  termMonths: number;
  interestRate?: number;
  purpose?: string;
  itemName?: string;
};

export type IssueLoanBody = {
  issueDate?: string;
  itemName?: string;
  supplierName?: string;
  itemCost?: number;
  employeeAcknowledged?: boolean;
};

export type LoanEmployeeOption = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department?: string | null;
};

export const listLoanTypeOptions = (token?: string) =>
  coreFetch<
    Array<{ value: LoanType; label: string; isItemLoan: boolean }>
  >('/api/v1/loans/type-options', { token });

export const listLoanEmployeeOptions = (token?: string) =>
  coreFetch<LoanEmployeeOption[]>('/api/v1/loans/employee-options', { token });

export const listLoans = (employeeId?: string, token?: string) => {
  const q = employeeId
    ? `?employeeId=${encodeURIComponent(employeeId)}`
    : '';
  return coreFetch<EmployeeLoan[]>(`/api/v1/loans${q}`, { token });
};

export const createLoan = (body: CreateLoanBody, token?: string) =>
  coreFetch<EmployeeLoan>('/api/v1/loans', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const approveLoan = (id: string, token?: string) =>
  coreFetch<{ loan: EmployeeLoan; installments: LoanInstallment[] }>(
    `/api/v1/loans/${id}/approve`,
    { method: 'POST', body: '{}', token },
  );

export const issueLoan = (id: string, body: IssueLoanBody, token?: string) =>
  coreFetch<{ loan: EmployeeLoan; installments: LoanInstallment[] }>(
    `/api/v1/loans/${id}/issue`,
    { method: 'POST', body: JSON.stringify(body), token },
  );

export const rejectLoan = (id: string, reason: string, token?: string) =>
  coreFetch<EmployeeLoan>(`/api/v1/loans/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const listLoanInstallments = (id: string, token?: string) =>
  coreFetch<LoanInstallment[]>(`/api/v1/loans/${id}/installments`, { token });

export const getLoanStatement = (id: string, token?: string) =>
  coreFetch<LoanStatement>(`/api/v1/loans/${id}/statement`, { token });
