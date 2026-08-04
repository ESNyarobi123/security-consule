/**
 * Portal 35.14 — other security company B2B + HR triage.
 */
import {
  authHeaders,
  partnerAuthHeaders,
} from '@pssms/auth';
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

export type B2bPartnerProfile = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
};

export type GuardSupplyRequest = {
  id: string;
  organizationId: string;
  partnerId: string;
  partnerCode?: string | null;
  partnerName?: string | null;
  referenceNumber: string;
  guardCount: number;
  siteLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  criteriaNotes?: string | null;
  status: string;
  processedBy?: string | null;
  processedAt?: string | null;
  staffNotes?: string | null;
  createdAt: string;
  createdBy?: string | null;
};

export type CreateGuardSupplyRequestInput = {
  guardCount: number;
  siteLocation?: string;
  startDate?: string;
  endDate?: string;
  criteriaNotes?: string;
};

async function partnerFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...partnerAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

async function staffFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

/** Partner portal login → POST /auth/login */
export async function partnerLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export const getB2bPartnerMe = (token?: string) =>
  partnerFetch<B2bPartnerProfile>('/api/v1/recruitment/b2b/partners/me', {
    token,
  });

export const listPartnerGuardSupplyRequests = (
  status?: string,
  token?: string,
) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return partnerFetch<GuardSupplyRequest[]>(
    `/api/v1/recruitment/b2b/requests${q}`,
    { token },
  );
};

export const createPartnerGuardSupplyRequest = (
  body: CreateGuardSupplyRequestInput,
  token?: string,
) =>
  partnerFetch<GuardSupplyRequest>('/api/v1/recruitment/b2b/requests', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

/** HR staff — org-wide list */
export const listStaffGuardSupplyRequests = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return staffFetch<GuardSupplyRequest[]>(
    `/api/v1/recruitment/b2b/requests${q}`,
    { token },
  );
};

export const updateGuardSupplyRequestStatus = (
  id: string,
  body: { status: string; staffNotes?: string },
  token?: string,
) =>
  staffFetch<GuardSupplyRequest>(
    `/api/v1/recruitment/b2b/requests/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );
