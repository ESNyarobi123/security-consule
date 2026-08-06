/**
 * External E5 — consultant/auditor self-view (visitor-web /consultant).
 */
import { consultantAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';
import type { VisitorAppointment, VisitorEntry } from './admin';

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

export type ConsultantVisitProfile = {
  userId: string;
  contractorUserId?: string;
  email: string;
  fullName: string;
  appointmentCount: number;
  appointments: VisitorAppointment[];
};

async function consultantFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...consultantAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

/** Consultant portal login → POST /auth/login */
export async function consultantLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export const getConsultantMe = (token?: string) =>
  consultantFetch<ConsultantVisitProfile>('/api/v1/visitors/me', { token });

export const listConsultantAppointments = (token?: string) =>
  consultantFetch<VisitorAppointment[]>('/api/v1/visitors/me/appointments', {
    token,
  });

export const listConsultantEntries = (token?: string) =>
  consultantFetch<VisitorEntry[]>('/api/v1/visitors/me/entries', { token });
