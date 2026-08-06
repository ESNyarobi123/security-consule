/**
 * External E3 — approved vehicle owner/driver self-view (parking-web /owner).
 */
import { ownerAuthHeaders } from '@pssms/auth';
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

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...ownerAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
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
