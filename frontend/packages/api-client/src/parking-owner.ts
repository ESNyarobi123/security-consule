/**
 * External E3 — approved vehicle owner/driver self-view (parking-web /owner).
 */
import {
  clearOwnerSession,
  getOwnerRefreshToken,
  getOwnerSessionUser,
  getOwnerToken,
  ownerAuthHeaders,
  setOwnerSession,
  setOwnerTokens,
} from '@pssms/auth';
import { errorMessageFromBody } from './errors';
import type { LoginResult } from './index';
import type {
  ParkingOpsEntry,
  ParkingOpsPermit,
  ParkingOpsVehicle,
} from './parking-ops';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

/**
 * Owner calls used to `throw new Error(await res.text())`, which printed a raw
 * JSON envelope in the portal. Use the shared message extractor instead.
 */
async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      errorMessageFromBody(
        text,
        res.status === 401
          ? 'Session expired — please sign in again.'
          : `Request failed (${res.status})`,
      ),
    );
  }
  if (!text.trim()) return undefined as T;
  const json = JSON.parse(text) as ApiEnvelope<T>;
  return json.data;
}

async function refreshOwnerSession(): Promise<string | null> {
  const refreshToken = getOwnerRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    // Flat pair, same as the ops portal (not `data.tokens`).
    const json = (await res.json()) as ApiEnvelope<{
      accessToken?: string;
      refreshToken?: string;
    }>;
    if (!json.data?.accessToken) return null;
    const user = getOwnerSessionUser();
    if (user) {
      setOwnerSession(json.data.accessToken, user, json.data.refreshToken);
    } else {
      setOwnerTokens(json.data.accessToken, json.data.refreshToken);
    }
    return json.data.accessToken;
  } catch {
    return null;
  }
}

export type ParkingOwnerProfile = {
  ownerUserId: string;
  email: string;
  fullName: string;
  vehicles: ParkingOpsVehicle[];
};

async function ownerFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const build = (bearer?: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...ownerAuthHeaders(bearer ?? init?.token),
      ...init?.headers,
    },
  });

  const usingPortalSession = !init?.token && !!getOwnerToken();
  let res = await fetch(`${coreUrl()}${path}`, build());

  if (res.status === 401 && usingPortalSession) {
    const renewed = await refreshOwnerSession();
    if (renewed) {
      res = await fetch(`${coreUrl()}${path}`, build(renewed));
    }
  }

  if (res.status === 401 && usingPortalSession) {
    clearOwnerSession();
    if (
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/owner/login')
    ) {
      window.location.replace('/owner/login?expired=1');
    }
  }

  return parseEnvelope<T>(res);
}

/** Owner portal login → POST /auth/login */
export async function ownerLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export const getParkingOwnerMe = (token?: string) =>
  ownerFetch<ParkingOwnerProfile>('/api/v1/parking/me', { token });

export const listOwnerPermits = (token?: string) =>
  ownerFetch<ParkingOpsPermit[]>('/api/v1/parking/me/permits', { token });

export const listOwnerEntries = (token?: string) =>
  ownerFetch<ParkingOpsEntry[]>('/api/v1/parking/me/entries', { token });
