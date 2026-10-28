/**
 * External E4 — contractor/guest self-view (visitor-web /contractor).
 */
import {
  clearContractorSession,
  getContractorRefreshToken,
  getContractorToken,
  setContractorTokens,
} from '@pssms/auth';
import type { LoginResult } from './index';
import type { VisitorAppointment, VisitorEntry } from './admin';
import { parseApiEnvelope } from './errors';
import { createSessionFetch } from './session';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

async function parseEnvelope<T>(res: Response): Promise<T> {
  return parseApiEnvelope<T>(res);
}

/** Contractor self-service session (silent refresh, dead-session redirect). */
const contractorSession = createSessionFetch({
  key: 'contractor',
  getAccessToken: getContractorToken,
  getRefreshToken: getContractorRefreshToken,
  setTokens: setContractorTokens,
  clearSession: clearContractorSession,
  loginPath: '/contractor/login',
});

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
  return contractorSession.request<T>(path, init);
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
