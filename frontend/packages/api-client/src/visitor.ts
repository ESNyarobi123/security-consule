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
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

export type VisitorPublicConfig = {
  organizationId: string;
  customerId: string;
  siteId: string;
};

export type CreatePublicAppointmentInput = {
  organizationId: string;
  customerId: string;
  siteId: string;
  visitorName: string;
  visitorPhone?: string;
  purpose: string;
  hostName?: string;
  validFrom: string;
  validUntil: string;
};

/**
 * Optional backend helper — may 404 until implemented.
 * Callers should fall back to NEXT_PUBLIC_* env vars.
 */
export async function getVisitorPublicConfig(): Promise<VisitorPublicConfig | null> {
  try {
    const res = await fetch(`${coreUrl()}/api/v1/visitors/public-config`);
    if (res.status === 404) return null;
    return parseEnvelope<VisitorPublicConfig>(res);
  } catch {
    return null;
  }
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
