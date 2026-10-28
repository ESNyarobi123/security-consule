/**
 * External E6 — service-provider self-view (visitor-web /provider).
 */
import {
  clearProviderSession,
  getProviderRefreshToken,
  getProviderToken,
  setProviderTokens,
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

/** Service-provider self-service session (silent refresh, dead-session redirect). */
const providerSession = createSessionFetch({
  key: 'provider',
  getAccessToken: getProviderToken,
  getRefreshToken: getProviderRefreshToken,
  setTokens: setProviderTokens,
  clearSession: clearProviderSession,
  loginPath: '/provider/login',
});

export type ProviderVisitProfile = {
  userId: string;
  contractorUserId?: string;
  email: string;
  fullName: string;
  appointmentCount: number;
  appointments: VisitorAppointment[];
};

async function providerFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  return providerSession.request<T>(path, init);
}

/** Service-provider portal login → POST /auth/login */
export async function providerLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export const getProviderMe = (token?: string) =>
  providerFetch<ProviderVisitProfile>('/api/v1/visitors/me', { token });

export const listProviderAppointments = (token?: string) =>
  providerFetch<VisitorAppointment[]>('/api/v1/visitors/me/appointments', {
    token,
  });

export const listProviderEntries = (token?: string) =>
  providerFetch<VisitorEntry[]>('/api/v1/visitors/me/entries', { token });
