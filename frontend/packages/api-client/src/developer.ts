/**
 * Developer & Integration portal (§35.24) — admin-web `/developer`.
 *
 * All calls go through core-api (:4001) with admin JWT Bearer.
 * Do NOT call integration-gateway (:4003) from the browser — inbox/providers
 * there require INTEGRATION_SERVICE_TOKEN; core-api proxies or reads Prisma.
 *
 * Env (frontend URLs for optional client-side probes — prefer server health API):
 *   NEXT_PUBLIC_CORE_API_URL       default http://localhost:4001
 *   NEXT_PUBLIC_REPORTING_API_URL  default http://localhost:4005
 *   NEXT_PUBLIC_INTEGRATION_GATEWAY_URL  default http://localhost:4003 (docs only)
 *   NEXT_PUBLIC_VISION_AI_URL      default http://localhost:8000
 *   NEXT_PUBLIC_ANALYTICS_AI_URL   default http://localhost:8001
 *   NEXT_PUBLIC_REALTIME_GATEWAY_URL default http://localhost:4004
 */
import { authHeaders, clearSession, getRefreshToken, setTokens } from '@pssms/auth';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4001';

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiEnvelope<{
          accessToken: string;
          refreshToken: string;
        }>;
        setTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function coreFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const doFetch = (authToken?: string) =>
    fetch(`${coreUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(authToken ?? init?.token),
        ...init?.headers,
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !init?.token) {
    const newToken = await tryRefresh();
    if (newToken) res = await doFetch(newToken);
    if (res.status === 401 && typeof window !== 'undefined') {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign(
          `/login?error=${encodeURIComponent('Session expired — please sign in again')}`,
        );
      }
    }
  }
  return parseEnvelope<T>(res);
}

// ── Platform service health (server-side probes) ──

export type PlatformServiceHealth = {
  code: string;
  name: string;
  url: string;
  path: string;
  status: 'ok' | 'down';
  latencyMs: number | null;
  detail?: string;
};

export type PlatformHealthResponse = {
  checkedAt: string;
  services: PlatformServiceHealth[];
};

/** GET /api/v1/developer/services/health — JWT required */
export const getPlatformServicesHealth = (token?: string) =>
  coreFetch<PlatformHealthResponse>('/api/v1/developer/services/health', {
    token,
  });

// ── Provider adapters ──

export type ProviderAdapterHealth = {
  code: string;
  category: string;
  status: string;
  adapterClass?: string;
  isEnabled?: boolean;
  detail?: string;
};

export type ProvidersHealthResponse = {
  source: 'integration-gateway' | 'core-api-fallback';
  checkedAt: string;
  adapters: ProviderAdapterHealth[];
  error?: string;
};

/** GET /api/v1/developer/providers/health — JWT required */
export const getProvidersHealth = (token?: string) =>
  coreFetch<ProvidersHealthResponse>('/api/v1/developer/providers/health', {
    token,
  });

export type ProviderPingResult = {
  code: string;
  ok: boolean;
  latencyMs?: number | null;
  detail?: string;
  checkedAt?: string;
};

/** POST /api/v1/developer/providers/:code/ping — JWT required */
export const pingProvider = (code: string, token?: string) =>
  coreFetch<ProviderPingResult>(
    `/api/v1/developer/providers/${encodeURIComponent(code)}/ping`,
    { method: 'POST', body: '{}', token },
  );

// ── Webhook inbox ──

export type WebhookInboxEntry = {
  id: string;
  organizationId?: string | null;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  signatureValid: boolean;
  status: string;
  retryCount: number;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

/** GET /api/v1/developer/webhooks/inbox?status= — JWT required */
export const listWebhookInbox = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<WebhookInboxEntry[]>(
    `/api/v1/developer/webhooks/inbox${q}`,
    { token },
  );
};

/** POST /api/v1/developer/webhooks/inbox/:id/replay — JWT required */
export const replayWebhookInbox = (id: string, token?: string) =>
  coreFetch<WebhookInboxEntry>(
    `/api/v1/developer/webhooks/inbox/${id}/replay`,
    { method: 'POST', token },
  );

// ── Integration outbox ──

export type IntegrationOutboxEntry = {
  id: string;
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: string;
  idempotencyKey: string;
  retryCount: number;
  nextRetryAt: string;
  publishedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

/** GET /api/v1/developer/outbox?status= — default PENDING+FAILED, JWT required */
export const listIntegrationOutbox = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<IntegrationOutboxEntry[]>(
    `/api/v1/developer/outbox${q}`,
    { token },
  );
};

/** POST /api/v1/developer/outbox/:id/replay — PENDING/FAILED only */
export const replayIntegrationOutbox = (id: string, token?: string) =>
  coreFetch<IntegrationOutboxEntry>(`/api/v1/developer/outbox/${id}/replay`, {
    method: 'POST',
    token,
  });

// ── Notifications (already on core-api) ──

export type NotificationRow = {
  id: string;
  organizationId: string;
  templateCode: string;
  channel: string;
  recipient: string;
  subject?: string | null;
  body: string;
  status: string;
  resourceType?: string | null;
  resourceId?: string | null;
  sentAt?: string | null;
  createdAt: string;
};

/** GET /api/v1/notifications?status= — JWT required */
export const listNotifications = (status?: string, token?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return coreFetch<NotificationRow[]>(`/api/v1/notifications${q}`, { token });
};

export const getNotification = (id: string, token?: string) =>
  coreFetch<NotificationRow>(`/api/v1/notifications/${id}`, { token });

// ── Config / logs / ping (P1) ──

export type DeveloperConfigStatus = {
  checkedAt: string;
  authMode: string;
  smsProvider: string;
  paymentProvider: string;
  webhookVerify: string;
  nodeEnv: string;
  integrationServiceTokenSet: boolean;
  gateways: Record<string, string | null>;
  brokers: {
    redisConfigured: boolean;
    rabbitmqConfigured: boolean;
    mqttConfigured: boolean;
    keycloakUrlPresent: boolean;
    redisTcpReachable: boolean | null;
  };
};

export type IntegrationRequestLog = {
  id: string;
  organizationId?: string | null;
  provider: string;
  direction: string;
  correlationId?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  summary?: string | null;
  createdAt: string;
};

/** @deprecated alias — prefer IntegrationRequestLog */
export type IntegrationRequestLogRow = IntegrationRequestLog;

/** GET /api/v1/developer/config — non-secret env status */
export const getDeveloperConfig = (token?: string) =>
  coreFetch<DeveloperConfigStatus>('/api/v1/developer/config', { token });

/** GET /api/v1/developer/logs?provider=&take= — JWT required */
export const listIntegrationLogs = (
  provider?: string,
  take?: number,
  token?: string,
) => {
  const params = new URLSearchParams();
  if (provider) params.set('provider', provider);
  if (take != null) params.set('take', String(take));
  const q = params.toString() ? `?${params.toString()}` : '';
  return coreFetch<IntegrationRequestLog[]>(`/api/v1/developer/logs${q}`, {
    token,
  });
};

/** Alias matching backend naming */
export const listDeveloperLogs = (
  opts?: { provider?: string; take?: number },
  token?: string,
) => listIntegrationLogs(opts?.provider, opts?.take, token);

export type DeveloperCatalogTopic = {
  id: string;
  name: string;
  status: 'WIRED' | 'CONSOLE' | 'DEFERRED' | string;
  note: string;
};

export type DeveloperCatalog = {
  generatedAt: string;
  topics: DeveloperCatalogTopic[];
  notes: string[];
};

export const getDeveloperCatalog = (token?: string) =>
  coreFetch<DeveloperCatalog>('/api/v1/developer/catalog', { token });

export type DeveloperApiDoc = {
  code: string;
  name: string;
  host: string | null;
  docsPath: string | null;
  note: string;
};

export type DeveloperApiSurface = {
  generatedAt: string;
  docs: DeveloperApiDoc[];
  prefixes: string[];
  notes: string[];
};

export const getDeveloperApiSurface = (token?: string) =>
  coreFetch<DeveloperApiSurface>('/api/v1/developer/apis', { token });

export type DeviceTypeCounts = { total: number; online: number };

export type DeveloperSystemsMonitor = {
  generatedAt: string;
  biometric: DeviceTypeCounts;
  rfid: DeviceTypeCounts;
  cctv: DeviceTypeCounts;
  scanners: DeviceTypeCounts;
  byType: Record<string, DeviceTypeCounts>;
  anprToday: number;
  openCctvEvents: number;
  mqttConnectionDevices: number;
  nestMqttClient: boolean;
  notes: string[];
};

export const getDeveloperSystems = (token?: string) =>
  coreFetch<DeveloperSystemsMonitor>('/api/v1/developer/systems', { token });

export type DeveloperExportKind = 'logs' | 'webhooks' | 'outbox';

export type DeveloperExportPack = {
  kind: string;
  filename: string;
  csv: string;
  rowCount: number;
};

export const exportDeveloperPack = (
  kind: DeveloperExportKind = 'logs',
  token?: string,
) =>
  coreFetch<DeveloperExportPack>(
    `/api/v1/developer/export?kind=${encodeURIComponent(kind)}`,
    { token },
  );
