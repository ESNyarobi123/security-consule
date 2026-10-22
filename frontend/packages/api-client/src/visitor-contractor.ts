/**
 * External E4 — contractor/guest self-view (visitor-web /contractor).
 */
import { contractorAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';
import type { VisitorAppointment, VisitorEntry } from './admin';
import { parseApiEnvelope } from './errors';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

async function parseEnvelope<T>(res: Response): Promise<T> {
  return parseApiEnvelope<T>(res);
}

export type ContractorVisitProfile = {
  userId?: string;
  contractorUserId: string;
  email: string;
  fullName: string;
  appointmentCount: number;
  appointments: VisitorAppointment[];
};

async function contractorFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...contractorAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

/** Contractor portal login → POST /auth/login */
export async function contractorLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export const getContractorMe = (token?: string) =>
  contractorFetch<ContractorVisitProfile>('/api/v1/visitors/me', { token });

export const listContractorAppointments = (token?: string) =>
  contractorFetch<VisitorAppointment[]>('/api/v1/visitors/me/appointments', {
    token,
  });

export const listContractorEntries = (token?: string) =>
  contractorFetch<VisitorEntry[]>('/api/v1/visitors/me/entries', { token });
