/**
 * Finance admin — petty cash vouchers (§22) for admin-web `/finance/petty-cash`.
 * Permission: `finance.manage`. ESS self-request stays on `/ess/petty-cash`.
 * AP payment vouchers are accountant-created (not ESS).
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

export type PettyCashFund = {
  id: string;
  organizationId: string;
  branchId?: string | null;
  name: string;
  imprestAmount: number;
  currentBalance: number;
  custodianId?: string | null;
  isActive: boolean;
};

export type PettyCashVoucher = {
  id: string;
  organizationId: string;
  fundId: string;
  fundName?: string | null;
  fundBalance?: number | null;
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
  rejectedReason?: string | null;
  createdBy: string;
  createdAt: string;
};

export const listPettyCashFunds = (token?: string) =>
  coreFetch<PettyCashFund[]>('/api/v1/finance/petty-cash/funds', { token });

export const listPettyCashVouchers = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<PettyCashVoucher[]>(
    `/api/v1/finance/petty-cash/vouchers${q}`,
    { token },
  );
};

export const approvePettyCashVoucher = (id: string, token?: string) =>
  coreFetch<PettyCashVoucher>(
    `/api/v1/finance/petty-cash/vouchers/${id}/approve`,
    { method: 'POST', body: '{}', token },
  );

export const rejectPettyCashVoucher = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<PettyCashVoucher>(
    `/api/v1/finance/petty-cash/vouchers/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      token,
    },
  );

export const issuePettyCashVoucher = (id: string, token?: string) =>
  coreFetch<PettyCashVoucher>(
    `/api/v1/finance/petty-cash/vouchers/${id}/issue`,
    { method: 'POST', body: '{}', token },
  );

/** Retire ISSUED voucher (REIMBURSED) — at least one of receiptUrl / notes required. */
export const reimbursePettyCashVoucher = (
  id: string,
  body: { receiptUrl?: string; notes?: string },
  token?: string,
) =>
  coreFetch<PettyCashVoucher>(
    `/api/v1/finance/petty-cash/vouchers/${id}/reimburse`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );

export type PaymentVoucher = {
  id: string;
  organizationId: string;
  voucherNumber: string;
  payeeName: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  amount: number;
  currency: string;
  purpose: string;
  status: string;
  approvalInstanceId?: string | null;
  approvedBy?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdBy: string;
  createdAt: string;
};

export const listPaymentVouchers = (token?: string) =>
  coreFetch<PaymentVoucher[]>('/api/v1/finance/payment-vouchers', { token });

export const createPaymentVoucher = (
  body: {
    payeeName: string;
    amount: number;
    purpose: string;
    supplierId?: string;
    purchaseOrderId?: string;
    currency?: string;
  },
  token?: string,
) =>
  coreFetch<PaymentVoucher>('/api/v1/finance/payment-vouchers', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const approvePaymentVoucher = (id: string, token?: string) =>
  coreFetch<PaymentVoucher>(`/api/v1/finance/payment-vouchers/${id}/approve`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const payPaymentVoucher = (
  id: string,
  paymentReference: string,
  token?: string,
) =>
  coreFetch<PaymentVoucher>(`/api/v1/finance/payment-vouchers/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ paymentReference }),
    token,
  });

export type FinanceMoneyCount = { count: number; amount: number };

export type FinanceReport = {
  from: string;
  to: string;
  invoicesIssued: FinanceMoneyCount;
  customerReceipts: FinanceMoneyCount;
  outstanding: FinanceMoneyCount;
  parkingBilled: FinanceMoneyCount;
  parkingReceipts: FinanceMoneyCount;
  pettyCashIssued: FinanceMoneyCount;
  pettyCashRetired: FinanceMoneyCount;
  supplierPayments: FinanceMoneyCount;
  paymentVouchersPaid: FinanceMoneyCount;
  bankReconciliationImplemented: boolean;
  notes: string[];
};

export const getFinanceReports = (
  opts?: { from?: string; to?: string; token?: string },
) => {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  const q = params.toString() ? `?${params}` : '';
  return coreFetch<FinanceReport>(`/api/v1/finance/reports${q}`, {
    token: opts?.token,
  });
};
