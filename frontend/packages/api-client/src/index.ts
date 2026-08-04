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
    b2bPartnerId?: string | null;
    mustChangePassword?: boolean;
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
  breakdown?: Record<string, unknown>;
};

export type KpiDrilldown = {
  code: string;
  name: string;
  category: string;
  unit: string;
  value: number;
  source: 'live' | 'snapshot';
  asOf: string;
  period: { from: string; to: string };
  breakdown?: Record<string, unknown>;
  bySite: {
    siteId: string;
    siteCode: string;
    siteName: string;
    value: number;
  }[];
  notes: string[];
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
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { code?: string; message?: string };
        message?: string | string[];
      };
      const code = json.error?.code;
      const msg = Array.isArray(json.message)
        ? json.message.join(', ')
        : json.error?.message ?? json.message ?? text;
      const err = new Error(String(msg));
      (err as Error & { status?: number; code?: string }).status = res.status;
      (err as Error & { status?: number; code?: string }).code = code;
      throw err;
    } catch (e) {
      if (e instanceof Error && (e as { status?: number }).status) throw e;
      throw new Error(text);
    }
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

/** Exchange refresh token for a new access + refresh pair. */
export async function refreshSession(refreshToken: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return parseEnvelope<LoginResult['tokens']>(res);
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

export async function getKpiDrilldown(
  token: string,
  code: string,
  params?: { from?: string; to?: string },
) {
  const url = new URL(
    `${reportingUrl()}/api/v1/reporting/kpis/${encodeURIComponent(code)}/drilldown`,
  );
  if (params?.from) url.searchParams.set('from', params.from);
  if (params?.to) url.searchParams.set('to', params.to);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseEnvelope<KpiDrilldown>(res);
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
export * from './hr';
export * from './ess';
export * from './loans';
export * from './assets';
export * from './finance';
export * from './customer';
export * from './supplier';
export * from './visitor';
export * from './recruitment';
export * from './recruitment-b2b';
export * from './parking-ops';
export * from './developer';
export * from './compliance';
export * from './branch-ops';
export * from './documents';
