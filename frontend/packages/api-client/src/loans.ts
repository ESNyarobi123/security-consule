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
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  status: LoanStatus | string;
  purpose: string;
  approvalInstanceId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  disbursedAt?: string | null;
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

export type CreateLoanBody = {
  employeeId: string;
  principalAmount: number;
  termMonths: number;
  interestRate?: number;
  purpose: string;
};

export type LoanEmployeeOption = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department?: string | null;
};

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

export const rejectLoan = (id: string, reason: string, token?: string) =>
  coreFetch<EmployeeLoan>(`/api/v1/loans/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const listLoanInstallments = (id: string, token?: string) =>
  coreFetch<LoanInstallment[]>(`/api/v1/loans/${id}/installments`, { token });
