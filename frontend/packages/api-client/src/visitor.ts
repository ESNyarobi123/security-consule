import type { VisitorAppointment } from './admin';

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
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { code?: string; message?: string };
        message?: string | string[];
      };
      const msg = Array.isArray(json.message)
        ? json.message.join(', ')
        : json.error?.message ?? json.message ?? text;
      throw new Error(msg);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      throw new Error(text || `Request failed ${res.status}`);
    }
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

export type VisitorPublicHost = {
  id: string;
  fullName: string;
  kind: 'PORTAL' | 'EMPLOYEE' | string;
};

export type VisitorPublicSite = {
  id: string;
  code: string;
  name: string;
};

export type VisitorVisitKindOption = {
  value: string;
  label: string;
};

export type VisitorPublicConfig = {
  organizationId: string;
  customerId: string;
  siteId: string;
  customerCode?: string;
  siteCode?: string;
  sites?: VisitorPublicSite[];
  hosts?: VisitorPublicHost[];
  visitKinds?: VisitorVisitKindOption[];
};

export type CreatePublicAppointmentInput = {
  organizationId: string;
  customerId: string;
  siteId: string;
  visitorName: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  purpose: string;
  visitKind?: string;
  hostUserId?: string;
  hostName?: string;
  vehiclePlate?: string;
  /** Module 12-D — both or neither */
  idType?: 'NIDA' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'OTHER';
  idNumber?: string;
  validFrom: string;
  validUntil: string;
};

/**
 * Demo org/customer/site IDs for public visitor-web.
 * Returns null only when the endpoint is missing (true 404 without body) or network fails —
 * callers fall back to NEXT_PUBLIC_* env vars.
 */
export async function getVisitorPublicConfig(): Promise<VisitorPublicConfig | null> {
  let res: Response;
  try {
    res = await fetch(`${coreUrl()}/api/v1/visitors/public-config`);
  } catch {
    // Network / CORS — caller falls back to NEXT_PUBLIC_* env.
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string };
        message?: string;
      };
      const msg =
        json.error?.message ?? json.message ?? `public-config ${res.status}`;
      // Missing endpoint → soft null; other API errors surface to UI.
      if (res.status === 404 && /not found/i.test(String(msg)) && !/demo/i.test(String(msg))) {
        return null;
      }
      throw new Error(msg);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      if (res.status === 404) return null;
      throw new Error(text || `public-config ${res.status}`);
    }
  }
  return parseEnvelope<VisitorPublicConfig>(res);
}

/** Public POST /visitors/appointments — never exposes gate verify/approve. */
export async function createPublicVisitorAppointment(
  body: CreatePublicAppointmentInput,
) {
  const res = await fetch(`${coreUrl()}/api/v1/visitors/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseEnvelope<VisitorAppointment>(res);
}

/** Authenticated E4/E5/E6 POST /visitors/me/appointments — binds userId; no gate code. */
export async function createOwnVisitorAppointment(
  body: CreatePublicAppointmentInput,
  token: string,
) {
  const res = await fetch(`${coreUrl()}/api/v1/visitors/me/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return parseEnvelope<VisitorAppointment>(res);
}
