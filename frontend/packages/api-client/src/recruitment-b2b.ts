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
  error?: { code?: string; message?: string };
};

function errorMessageFromBody(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string | string[] };
      message?: string | string[];
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
    throw new Error(errorMessageFromBody(text, 'Request failed'));
  }
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
  qualifications?: string | null;
  trainingNeeds?: string | null;
  urgency?: string;
  serviceTerms?: string | null;
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
  siteLocation: string;
  startDate?: string;
  endDate?: string;
  qualifications?: string;
  trainingNeeds?: string;
  urgency?: 'STANDARD' | 'HIGH' | 'CRITICAL';
  serviceTerms?: string;
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

export type RegisterB2bPartnerInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterB2bPartnerResult = {
  partnerId: string;
  code: string;
  name: string;
  status: string;
  email: string;
  message: string;
};

/** Public POST /recruitment/b2b/partners/register */
export async function registerB2bPartner(body: RegisterB2bPartnerInput) {
  const res = await fetch(
    `${coreUrl()}/api/v1/recruitment/b2b/partners/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return parseEnvelope<RegisterB2bPartnerResult>(res);
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

export const listStaffB2bPartners = (token?: string) =>
  staffFetch<B2bPartnerProfile[]>('/api/v1/recruitment/b2b/partners', {
    token,
  });

export const updateB2bPartnerStatus = (
  id: string,
  status: string,
  token?: string,
) =>
  staffFetch<B2bPartnerProfile>(
    `/api/v1/recruitment/b2b/partners/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    },
  );

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
