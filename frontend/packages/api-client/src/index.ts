export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

export type LoginResult = {
  tokens: { accessToken: string; refreshToken: string };
  user: {
    id: string;
    email: string;
    fullName: string;
    organizationId: string;
    roles: string[];
    permissions: string[];
    customerId?: string | null;
    supplierId?: string | null;
  };
};

export type KpiItem = {
  code: string;
  name: string;
  category: string;
  unit: string;
  value: number;
  source: 'live' | 'snapshot';
  asOf: string;
};

export type ExecutiveDashboard = {
  organizationId: string;
  generatedAt: string;
  period: { from: string; to: string; granularity: string };
  kpis: KpiItem[];
  cache: { hit: boolean; expiresAt: string | null };
};

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

const reportingUrl = () =>
  process.env.NEXT_PUBLIC_REPORTING_API_URL ?? 'http://localhost:4005';

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export type OidcPublicConfig = {
  authMode: 'local' | 'dual' | 'keycloak';
  issuer: string | null;
  jwksUri: string | null;
  clients: {
    api: string | null;
    adminWeb: string | null;
  };
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  localLoginEnabled: boolean;
};

export async function getOidcConfig(): Promise<OidcPublicConfig> {
  const res = await fetch(`${coreUrl()}/api/v1/auth/oidc/config`);
  return parseEnvelope<OidcPublicConfig>(res);
}

/** Nest profile used after both local login and Keycloak SSO. */
export async function getMe(token: string): Promise<LoginResult['user']> {
  const res = await fetch(`${coreUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        message?: string | string[];
        error?: string;
      };
      const msg = Array.isArray(json.message)
        ? json.message.join(', ')
        : json.message ?? json.error ?? text;
      throw new Error(String(msg));
    } catch (err) {
      if (err instanceof Error && err.message !== text) throw err;
      throw new Error(text);
    }
  }
  const json = (await res.json()) as ApiEnvelope<LoginResult['user']>;
  return json.data;
}

export async function getExecutiveDashboard(
  token: string,
  params?: { from?: string; to?: string },
) {
  const url = new URL(`${reportingUrl()}/api/v1/reporting/dashboards/executive`);
  if (params?.from) url.searchParams.set('from', params.from);
  if (params?.to) url.searchParams.set('to', params.to);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseEnvelope<ExecutiveDashboard>(res);
}

export async function getReportingHealth(token: string) {
  const res = await fetch(`${reportingUrl()}/api/v1/reporting/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseEnvelope<{ status: string; analyticsAi: { status: string } }>(
    res,
  );
}

export function executiveDashboardExportUrl(
  format: 'csv' | 'xlsx' | 'pdf',
  params?: { from?: string; to?: string },
) {
  const url = new URL(
    `${reportingUrl()}/api/v1/reporting/exports/executive-dashboard.${format}`,
  );
  if (params?.from) url.searchParams.set('from', params.from);
  if (params?.to) url.searchParams.set('to', params.to);
  return url.toString();
}

/** @deprecated use executiveDashboardExportUrl('csv', params) */
export function executiveDashboardCsvUrl(params?: {
  from?: string;
  to?: string;
}) {
  return executiveDashboardExportUrl('csv', params);
}

export async function refreshKpis(
  token: string,
  params?: { from?: string; to?: string },
) {
  const res = await fetch(`${reportingUrl()}/api/v1/reporting/kpis/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params ?? {}),
  });
  return parseEnvelope<{ refreshed: number }>(res);
}

export async function downloadExecutiveExport(
  token: string,
  format: 'csv' | 'xlsx' | 'pdf',
  params?: { from?: string; to?: string },
): Promise<Blob> {
  const res = await fetch(executiveDashboardExportUrl(format, params), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export * from './admin';
export * from './customer';
export * from './supplier';
export * from './visitor';
export * from './recruitment';
export * from './parking-ops';
