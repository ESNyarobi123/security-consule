import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OutboxStatus, WebhookInboxStatus, DeviceType, DeviceStatus, DeviceEventType, DeviceEventStatus, DeviceConnection } from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, resolveSmsTransport } from '@pssms/shared';
import { Socket } from 'net';

const WEBHOOK_INBOX_SAFE_SELECT = {
  id: true,
  organizationId: true,
  provider: true,
  eventType: true,
  idempotencyKey: true,
  signatureValid: true,
  status: true,
  retryCount: true,
  errorMessage: true,
  processedAt: true,
  createdAt: true,
} as const;

const OUTBOX_SAFE_SELECT = {
  id: true,
  organizationId: true,
  eventType: true,
  aggregateType: true,
  aggregateId: true,
  status: true,
  idempotencyKey: true,
  retryCount: true,
  nextRetryAt: true,
  publishedAt: true,
  errorMessage: true,
  createdAt: true,
} as const;

const REQUEST_LOG_SAFE_SELECT = {
  id: true,
  organizationId: true,
  provider: true,
  direction: true,
  correlationId: true,
  statusCode: true,
  durationMs: true,
  summary: true,
  createdAt: true,
} as const;

/** Replay only failed / DLQ webhook rows — avoid re-processing PROCESSED. */
const WEBHOOK_REPLAYABLE: WebhookInboxStatus[] = [
  WebhookInboxStatus.FAILED,
  WebhookInboxStatus.DLQ,
];

export type ServiceHealthItem = {
  code: string;
  name: string;
  url: string;
  path: string;
  /**
   * `ok` = probed and healthy, `down` = probed and unreachable, `not_deployed`
   * = this deployment does not run the service at all (e.g. api-gateway on a
   * single-VPS install). Reporting an absent service as `down` made the board
   * look broken in production.
   */
  status: 'ok' | 'down' | 'not_deployed';
  latencyMs: number | null;
  detail?: string;
};

export type ProviderHealthItem = {
  code: string;
  category: string;
  status: string;
  adapterClass?: string;
  isEnabled?: boolean;
  detail?: string;
};

export type DeveloperConfigStatus = {
  checkedAt: string;
  authMode: string;
  smsProvider: string;
  paymentProvider: string;
  webhookVerify: string;
  nodeEnv: string;
  integrationServiceTokenSet: boolean;
  gateways: {
    coreApi: string | null;
    apiGateway: string | null;
    integrationGateway: string | null;
    realtimeGateway: string | null;
    reportingService: string | null;
    visionAi: string | null;
    analyticsAi: string | null;
  };
  brokers: {
    redisConfigured: boolean;
    rabbitmqConfigured: boolean;
    mqttConfigured: boolean;
    keycloakUrlPresent: boolean;
    /** Best-effort TCP connect — not a full Redis PING protocol. */
    redisTcpReachable: boolean | null;
  };
};

export type ProviderPingResult = {
  code: string;
  ok: boolean;
  detail: string;
  latencyMs: number | null;
};

/** Columns accepted by the device-registry bulk import (§35.24 data import). */
export const DEVICE_IMPORT_COLUMNS = [
  'code',
  'name',
  'type',
  'connection',
  'siteCode',
  'vendor',
  'model',
  'serialNumber',
] as const;

export type DeviceImportRow = {
  line: number;
  code: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  message?: string;
};

export type DeviceImportReport = {
  kind: 'devices';
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: DeviceImportRow[];
  importedAt: string;
};

/**
 * Connected-systems verdict used by `/developer/connectivity` (Portal 35.24).
 *
 * Every status is evidence-based — no fake "UP" for a vendor that is not
 * wired. `CONSOLE` means the code path works but nothing leaves the machine
 * (dev adapters), `IDLE` means wired and healthy with no traffic in 24h.
 */
export type ConnectivityStatus =
  | 'CONNECTED'
  | 'CONSOLE'
  | 'IDLE'
  | 'DEGRADED'
  | 'NOT_CONFIGURED'
  | 'DEFERRED';

export type ConnectivitySystem = {
  code: string;
  name: string;
  group: 'PLATFORM' | 'MESSAGING' | 'PAYMENTS' | 'DEVICES' | 'DATA';
  status: ConnectivityStatus;
  /** True only when a real transport/vendor is doing the work. */
  live: boolean;
  configured: boolean;
  detail: string;
  lastActivityAt: string | null;
  activity24h: number;
  failures24h: number;
  evidence: string[];
  href: string;
};

export type ConnectivityReport = {
  generatedAt: string;
  windowHours: number;
  summary: {
    total: number;
    connected: number;
    console: number;
    idle: number;
    degraded: number;
    notConfigured: number;
    deferred: number;
    traffic24h: number;
    failures24h: number;
  };
  services: ServiceHealthItem[];
  systems: ConnectivitySystem[];
  notes: string[];
};

type ProbeTarget = {
  code: string;
  name: string;
  envUrl: string;
  defaultUrl: string;
  path: string;
};

/** Real deployables only — no invented fake health targets. */
const PLATFORM_SERVICES: ProbeTarget[] = [
  {
    code: 'core-api',
    name: 'Core API',
    envUrl: 'CORE_API_INTERNAL_URL',
    defaultUrl: 'http://localhost:4001',
    path: '/api/v1/health',
  },
  {
    code: 'api-gateway',
    name: 'API Gateway',
    envUrl: 'API_GATEWAY_URL',
    defaultUrl: 'http://localhost:4000',
    path: '/api/v1/health',
  },
  {
    code: 'background-worker',
    name: 'Background Worker',
    envUrl: 'BACKGROUND_WORKER_URL',
    defaultUrl: 'http://localhost:4002',
    // Worker has no global prefix — health is at /health
    path: '/health',
  },
  {
    code: 'integration-gateway',
    name: 'Integration Gateway',
    envUrl: 'INTEGRATION_GATEWAY_URL',
    defaultUrl: 'http://localhost:4003',
    path: '/api/v1/health',
  },
  {
    code: 'realtime-gateway',
    name: 'Realtime Gateway',
    envUrl: 'REALTIME_GATEWAY_URL',
    defaultUrl: 'http://localhost:4004',
    path: '/api/v1/health',
  },
  {
    code: 'reporting-service',
    name: 'Reporting Service',
    envUrl: 'REPORTING_SERVICE_INTERNAL_URL',
    defaultUrl: 'http://localhost:4005',
    path: '/api/v1/health',
  },
  {
    code: 'vision-ai',
    name: 'Vision AI',
    envUrl: 'VISION_AI_URL',
    defaultUrl: 'http://localhost:8000',
    path: '/health',
  },
  {
    code: 'analytics-ai',
    name: 'Analytics AI',
    envUrl: 'ANALYTICS_AI_URL',
    defaultUrl: 'http://localhost:8001',
    path: '/health',
  },
];

@Injectable()
export class DeveloperIntegrationsService {
  private readonly logger = new Logger(DeveloperIntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPlatformHealth(): Promise<{
    checkedAt: string;
    services: ServiceHealthItem[];
  }> {
    const services = await Promise.all(
      PLATFORM_SERVICES.map((t) => this.probeService(t)),
    );
    return { checkedAt: new Date().toISOString(), services };
  }

  /**
   * Prefer integration-gateway adapter registry (service-token).
   * Falls back to ProviderRegistry + local vision probe if gateway is down.
   */
  async listProvidersHealth(user?: AuthUser): Promise<{
    source: 'integration-gateway' | 'core-api-fallback';
    checkedAt: string;
    adapters: ProviderHealthItem[];
    /** Plain-language explanation when the gateway is not reachable. */
    error?: string;
    /** Raw technical reason, for the logs drawer only. */
    errorDetail?: string;
  }> {
    const started = Date.now();
    const base =
      process.env.INTEGRATION_GATEWAY_URL ?? 'http://localhost:4003';
    const token =
      process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';

    try {
      const res = await fetch(`${base}/api/v1/providers/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        success?: boolean;
        data?: { adapters?: ProviderHealthItem[]; checkedAt?: string };
        adapters?: ProviderHealthItem[];
        checkedAt?: string;
      };
      const payload = json.data ?? json;
      const adapters = this.ensureWhatsAppHonesty(payload.adapters ?? []);
      await this.writeRequestLog({
        organizationId: user?.organizationId,
        provider: 'providers-health',
        direction: 'OUTBOUND',
        statusCode: res.status,
        durationMs: Date.now() - started,
        summary: `proxy integration-gateway adapters=${adapters.length}`,
      });
      return {
        source: 'integration-gateway',
        checkedAt: payload.checkedAt ?? new Date().toISOString(),
        adapters,
      };
    } catch (err) {
      this.logger.warn(
        `providers/health proxy failed, using fallback: ${String(err)}`,
      );
      const fallback = this.ensureWhatsAppHonesty(
        await this.providersHealthFallback(),
      );
      await this.writeRequestLog({
        organizationId: user?.organizationId,
        provider: 'providers-health',
        direction: 'OUTBOUND',
        statusCode: 503,
        durationMs: Date.now() - started,
        summary: `fallback: ${String(err).slice(0, 200)}`,
      });
      return {
        source: 'core-api-fallback',
        checkedAt: new Date().toISOString(),
        adapters: fallback,
        // Never surface a raw TypeError to the portal. The fallback is a
        // working state, not a failure — say what happened in plain words.
        error: this.providerFallbackMessage(base),
        errorDetail: String(err).slice(0, 300),
      };
    }
  }

  /**
   * Human sentence for "adapter registry came from the core-api fallback".
   * Mentioned in the Developer portal as an info line, never as an error.
   */
  private providerFallbackMessage(base: string): string {
    const host = this.safeHostname(base) ?? 'integration-gateway';
    const configured = Boolean(process.env.INTEGRATION_GATEWAY_URL?.trim());
    return configured
      ? `Integration gateway at ${host} did not respond — the adapter registry is being read from the core-api fallback`
      : 'Integration gateway is not configured in this environment (INTEGRATION_GATEWAY_URL unset) — the adapter registry is being read from the core-api fallback';
  }

  /** Non-secret env / broker status for Developer portal. Never returns secrets. */
  async getConfigStatus(): Promise<DeveloperConfigStatus> {
    const redisConfigured = Boolean(
      process.env.REDIS_URL?.trim() ||
        process.env.REDIS_HOST?.trim() ||
        process.env.REDIS_PORT?.trim(),
    );
    const rabbitmqConfigured = Boolean(process.env.RABBITMQ_URL?.trim());
    const mqttConfigured = Boolean(
      process.env.MQTT_URL?.trim() || process.env.MQTT_WS_URL?.trim(),
    );
    const keycloakUrlPresent = Boolean(
      process.env.KEYCLOAK_URL?.trim() || process.env.KEYCLOAK_ISSUER?.trim(),
    );

    let redisTcpReachable: boolean | null = null;
    if (redisConfigured) {
      redisTcpReachable = await this.probeRedisTcp();
    }

    return {
      checkedAt: new Date().toISOString(),
      authMode: process.env.AUTH_MODE ?? 'dual',
      smsProvider: process.env.SMS_PROVIDER || '(unset)',
      paymentProvider: process.env.PAYMENT_PROVIDER || '(unset)',
      webhookVerify: process.env.WEBHOOK_VERIFY ?? 'false',
      nodeEnv: process.env.NODE_ENV ?? 'development',
      integrationServiceTokenSet: Boolean(
        process.env.INTEGRATION_SERVICE_TOKEN?.trim(),
      ),
      gateways: {
        coreApi: this.safeHostname(
          process.env.CORE_API_INTERNAL_URL ?? 'http://localhost:4001',
        ),
        apiGateway: this.safeHostname(
          process.env.API_GATEWAY_URL ?? 'http://localhost:4000',
        ),
        integrationGateway: this.safeHostname(
          process.env.INTEGRATION_GATEWAY_URL ?? 'http://localhost:4003',
        ),
        realtimeGateway: this.safeHostname(
          process.env.REALTIME_GATEWAY_URL ?? 'http://localhost:4004',
        ),
        reportingService: this.safeHostname(
          process.env.REPORTING_SERVICE_INTERNAL_URL ??
            'http://localhost:4005',
        ),
        visionAi: this.safeHostname(
          process.env.VISION_AI_URL ?? 'http://localhost:8000',
        ),
        analyticsAi: this.safeHostname(
          process.env.ANALYTICS_AI_URL ?? 'http://localhost:8001',
        ),
      },
      brokers: {
        redisConfigured,
        rabbitmqConfigured,
        mqttConfigured,
        keycloakUrlPresent,
        redisTcpReachable,
      },
    };
  }

  /**
   * Portal 35.24 — "is everything connected and actually working?"
   *
   * One evidence-based answer per integration: platform services probed live,
   * messaging channels judged from the transport config + 24h delivery rows,
   * device systems judged from the device registry (`status`, `lastSeenAt`),
   * and money rails judged from their adapter config. Nothing is reported as
   * CONNECTED unless a real transport is doing the work.
   */
  async connectivity(user: AuthUser): Promise<ConnectivityReport> {
    const org = user.organizationId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const smsTransport = resolveSmsTransport();

    const [
      health,
      notificationGroups,
      logGroups,
      webhookGroups,
      outboxGroups,
      deviceGroups,
      anpr24h,
      lastAnpr,
      lastDeviceEvent,
      lastPayment,
      gatewayRows,
    ] = await Promise.all([
      this.listPlatformHealth(),
      this.prisma.notification.groupBy({
        by: ['channel', 'status'],
        where: { organizationId: org, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.integrationRequestLog.groupBy({
        by: ['provider', 'statusCode'],
        where: {
          createdAt: { gte: since },
          OR: [{ organizationId: org }, { organizationId: null }],
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.webhookInbox.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: since },
          OR: [{ organizationId: org }, { organizationId: null }],
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.integrationOutbox.groupBy({
        by: ['status'],
        where: { organizationId: org, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.device.groupBy({
        by: ['type', 'status'],
        where: { organizationId: org },
        _count: { _all: true },
        _max: { lastSeenAt: true },
      }),
      this.prisma.anprResult.count({
        where: { organizationId: org, capturedAt: { gte: since } },
      }),
      this.prisma.anprResult.findFirst({
        where: { organizationId: org },
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true },
      }),
      this.prisma.deviceEvent.findFirst({
        where: { organizationId: org },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
      this.prisma.invoicePayment.findFirst({
        where: { organizationId: org },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      }),
      this.prisma.providerRegistry.findMany({ orderBy: { code: 'asc' } }),
    ]);

    // ── helpers ───────────────────────────────────────────────────────────
    const channelStats = (channel: string) => {
      let sent = 0;
      let failed = 0;
      let last: Date | null = null;
      for (const row of notificationGroups) {
        if (String(row.channel) !== channel) continue;
        const count = row._count?._all ?? 0;
        if (String(row.status) === 'SENT') sent += count;
        if (String(row.status) === 'FAILED') failed += count;
        const at = row._max?.createdAt ?? null;
        if (at && (!last || at > last)) last = at;
      }
      return { sent, failed, last };
    };

    const providerStats = (predicate: (provider: string) => boolean) => {
      let calls = 0;
      let failures = 0;
      let last: Date | null = null;
      for (const row of logGroups) {
        if (!predicate(row.provider)) continue;
        const count = row._count?._all ?? 0;
        calls += count;
        if ((row.statusCode ?? 0) >= 400) failures += count;
        const at = row._max?.createdAt ?? null;
        if (at && (!last || at > last)) last = at;
      }
      return { calls, failures, last };
    };

    const deviceStats = (types: DeviceType[]) => {
      let total = 0;
      let online = 0;
      let last: Date | null = null;
      for (const row of deviceGroups) {
        if (!types.includes(row.type)) continue;
        const count = row._count?._all ?? 0;
        total += count;
        if (row.status === DeviceStatus.ONLINE) online += count;
        const at = row._max?.lastSeenAt ?? null;
        if (at && (!last || at > last)) last = at;
      }
      return { total, online, last };
    };

    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

    const deviceSystem = (
      code: string,
      name: string,
      types: DeviceType[],
      href: string,
    ): ConnectivitySystem => {
      const stats = deviceStats(types);
      const status: ConnectivityStatus =
        stats.total === 0
          ? 'NOT_CONFIGURED'
          : stats.online > 0
            ? 'CONNECTED'
            : 'IDLE';
      return {
        code,
        name,
        group: 'DEVICES',
        status,
        live: stats.online > 0,
        configured: stats.total > 0,
        detail:
          stats.total === 0
            ? 'No devices registered for this system yet'
            : `${stats.online}/${stats.total} devices online`,
        lastActivityAt: iso(stats.last),
        activity24h: stats.total,
        failures24h: 0,
        evidence: [
          `${stats.total} registered`,
          `${stats.online} online · ${stats.total - stats.online} offline`,
          'source: devices registry (status + lastSeenAt)',
        ],
        href,
      };
    };

    const systems: ConnectivitySystem[] = [];

    // ── PLATFORM ──────────────────────────────────────────────────────────
    const deployedServices = health.services.filter(
      (s) => s.status !== 'not_deployed',
    );
    const absentServices = health.services.filter(
      (s) => s.status === 'not_deployed',
    );
    const downServices = deployedServices.filter((s) => s.status !== 'ok');
    systems.push({
      code: 'platform-services',
      name: 'Platform services',
      group: 'PLATFORM',
      status: downServices.length === 0 ? 'CONNECTED' : 'DEGRADED',
      live: true,
      configured: true,
      detail: `${deployedServices.length - downServices.length}/${deployedServices.length} deployed services responding${
        downServices.length
          ? ` — down: ${downServices.map((s) => s.code).join(', ')}`
          : ''
      }${
        absentServices.length
          ? ` · ${absentServices.length} not running here: ${absentServices
              .map((s) => s.code)
              .join(', ')}`
          : ''
      }`,
      lastActivityAt: health.checkedAt,
      activity24h: deployedServices.length,
      failures24h: downServices.length,
      evidence: health.services.map(
        (s) =>
          `${s.code}: ${s.status}${s.status === 'not_deployed' ? ' (absent here)' : ''}${
            s.latencyMs != null ? ` ${s.latencyMs}ms` : ''
          }`,
      ),
      href: '/developer/health',
    });

    systems.push({
      code: 'webhooks',
      name: 'Webhook inbox',
      group: 'PLATFORM',
      status:
        webhookGroups.length === 0
          ? 'IDLE'
          : (webhookGroups.find((g) => String(g.status) === 'FAILED' || String(g.status) === 'DLQ')?._count?._all ?? 0) > 0
            ? 'DEGRADED'
            : 'CONNECTED',
      live: true,
      configured: true,
      detail:
        webhookGroups.length === 0
          ? 'Wired — no inbound webhook events in the last 24h'
          : `${webhookGroups.reduce((n, g) => n + (g._count?._all ?? 0), 0)} events in 24h`,
      lastActivityAt: iso(
        webhookGroups
          .map((g) => g._max?.createdAt ?? null)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      ),
      activity24h: webhookGroups.reduce((n, g) => n + (g._count?._all ?? 0), 0),
      failures24h: webhookGroups
        .filter((g) => ['FAILED', 'DLQ'].includes(String(g.status)))
        .reduce((n, g) => n + (g._count?._all ?? 0), 0),
      evidence: webhookGroups.map(
        (g) => `${g.status}: ${g._count?._all ?? 0}`,
      ),
      href: '/developer/webhooks',
    });

    systems.push({
      code: 'outbox',
      name: 'Event outbox',
      group: 'PLATFORM',
      status:
        (outboxGroups.find((g) => String(g.status) === 'FAILED')?._count?._all ?? 0) > 0
          ? 'DEGRADED'
          : 'CONNECTED',
      live: true,
      configured: true,
      detail: `${outboxGroups.reduce((n, g) => n + (g._count?._all ?? 0), 0)} rows in 24h`,
      lastActivityAt: null,
      activity24h: outboxGroups.reduce((n, g) => n + (g._count?._all ?? 0), 0),
      failures24h: outboxGroups
        .filter((g) => String(g.status) === 'FAILED')
        .reduce((n, g) => n + (g._count?._all ?? 0), 0),
      evidence: outboxGroups.map((g) => `${g.status}: ${g._count?._all ?? 0}`),
      href: '/developer/outbox',
    });

    // ── MESSAGING ─────────────────────────────────────────────────────────
    const smsStats = channelStats('SMS');
    const smsLogs = providerStats((p) => /sms|fasthub|beem|nextsms|twilio/i.test(p));
    systems.push({
      code: 'sms',
      name: 'SMS gateway',
      group: 'MESSAGING',
      status: smsTransport.live
        ? smsStats.failed > 0
          ? 'DEGRADED'
          : smsStats.sent > 0
            ? 'CONNECTED'
            : 'IDLE'
        : smsTransport.provider === 'console'
          ? 'CONSOLE'
          : 'NOT_CONFIGURED',
      live: smsTransport.live,
      configured: smsTransport.provider !== 'console',
      detail: smsTransport.live
        ? smsStats.sent + smsStats.failed > 0
          ? `${smsTransport.provider} live — ${smsStats.sent} sent / ${smsStats.failed} failed in 24h`
          : `${smsTransport.provider} live — no SMS traffic in the last 24h`
        : smsTransport.provider === 'console'
          ? 'Console mode — messages are logged only, nothing is delivered'
          : `${smsTransport.provider} selected but credentials are incomplete`,
      lastActivityAt: iso(smsStats.last ?? smsLogs.last),
      activity24h: smsStats.sent + smsStats.failed,
      failures24h: smsStats.failed + smsLogs.failures,
      evidence: [
        `provider: ${smsTransport.provider}`,
        `sender id: ${smsTransport.senderId}`,
        `SMS_API_KEY: ${process.env.SMS_API_KEY?.trim() ? 'set' : 'missing'}`,
        `SMS_API_SECRET: ${process.env.SMS_API_SECRET?.trim() ? 'set' : 'missing'}`,
        `deliveries 24h: ${smsStats.sent} sent / ${smsStats.failed} failed`,
        `integration-gateway calls 24h: ${smsLogs.calls} (${smsLogs.failures} failed)`,
      ],
      href: '/developer/adapters',
    });

    const emailStats = channelStats('EMAIL');
    const emailProvider = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
    const emailConfigured = Boolean(process.env.EMAIL_API_URL?.trim());
    systems.push({
      code: 'email',
      name: 'Email gateway',
      group: 'MESSAGING',
      status:
        emailProvider && emailProvider !== 'console' && emailConfigured
          ? emailStats.failed > 0
            ? 'DEGRADED'
            : emailStats.sent > 0
              ? 'CONNECTED'
              : 'IDLE'
          : 'CONSOLE',
      live: Boolean(emailProvider) && emailProvider !== 'console' && emailConfigured,
      configured: emailConfigured,
      detail:
        emailProvider && emailProvider !== 'console' && emailConfigured
          ? `${emailProvider} live — ${emailStats.sent} sent / ${emailStats.failed} failed in 24h`
          : 'Console mode — emails are logged only, nothing is delivered',
      lastActivityAt: iso(emailStats.last),
      activity24h: emailStats.sent + emailStats.failed,
      failures24h: emailStats.failed,
      evidence: [
        `provider: ${emailProvider || '(unset → console)'}`,
        `EMAIL_API_URL: ${emailConfigured ? 'set' : 'missing'}`,
        `deliveries 24h: ${emailStats.sent} sent / ${emailStats.failed} failed`,
      ],
      href: '/developer/adapters',
    });

    const waStats = channelStats('WHATSAPP');
    const waConfigured = Boolean(
      process.env.WHATSAPP_API_URL?.trim() &&
        process.env.WHATSAPP_API_TOKEN?.trim(),
    );
    systems.push({
      code: 'whatsapp',
      name: 'WhatsApp API',
      group: 'MESSAGING',
      status: waConfigured ? 'DEGRADED' : 'DEFERRED',
      live: false,
      configured: waConfigured,
      detail: waConfigured
        ? 'Env is set but the Meta Cloud API sender is not coded — codes still go over SMS/email'
        : 'Not implemented — gate codes are delivered over SMS and email',
      lastActivityAt: iso(waStats.last),
      activity24h: waStats.sent + waStats.failed,
      failures24h: waStats.failed,
      evidence: [
        `WHATSAPP_API_URL: ${process.env.WHATSAPP_API_URL?.trim() ? 'set' : 'missing'}`,
        `WHATSAPP_API_TOKEN: ${process.env.WHATSAPP_API_TOKEN?.trim() ? 'set' : 'missing'}`,
        'dispatch falls back to SMS when WHATSAPP channel is requested',
      ],
      href: '/developer/adapters',
    });

    // ── PAYMENTS ──────────────────────────────────────────────────────────
    const paymentProvider = (process.env.PAYMENT_PROVIDER ?? '').trim().toLowerCase();
    const paymentConsole = !paymentProvider || paymentProvider === 'console';
    const paymentLogs = providerStats((p) => /payment|bank|mpesa|tigo|airtel|halo/i.test(p));
    const mobileMoney = ['mpesa', 'tigopesa', 'airtel', 'halopesa', 'mobile-money'].includes(
      paymentProvider,
    );
    const bankConfigured = Boolean(
      process.env.BANK_API_BASE_URL?.trim() && process.env.BANK_API_KEY?.trim(),
    );

    systems.push({
      code: 'payment-gateway',
      name: 'Payment gateway',
      group: 'PAYMENTS',
      status: paymentConsole ? 'CONSOLE' : paymentLogs.failures > 0 ? 'DEGRADED' : 'IDLE',
      live: !paymentConsole,
      configured: !paymentConsole,
      detail: paymentConsole
        ? 'Console adapter — payment requests are recorded, no PSP is called'
        : `${paymentProvider} adapter selected`,
      lastActivityAt: iso(paymentLogs.last),
      activity24h: paymentLogs.calls,
      failures24h: paymentLogs.failures,
      evidence: [
        `PAYMENT_PROVIDER: ${paymentProvider || '(unset → console)'}`,
        `integration calls 24h: ${paymentLogs.calls} (${paymentLogs.failures} failed)`,
        `invoice payments recorded: ${lastPayment ? 'yes' : 'none'}`,
      ],
      href: '/developer/adapters',
    });

    systems.push({
      code: 'mobile-money',
      name: 'Mobile money',
      group: 'PAYMENTS',
      status: mobileMoney && !paymentConsole ? 'IDLE' : 'DEFERRED',
      live: false,
      configured: mobileMoney,
      detail: mobileMoney
        ? 'Provider flag set — no M-Pesa / TigoPesa / Airtel / HaloPesa client is coded yet'
        : 'No mobile-money adapter registered (M-Pesa / TigoPesa / Airtel / HaloPesa deferred)',
      lastActivityAt: iso(lastPayment?.recordedAt ?? null),
      activity24h: 0,
      failures24h: 0,
      evidence: [
        `PAYMENT_PROVIDER: ${paymentProvider || '(unset)'}`,
        'payroll bank/mobile files are CSV exports, not API disbursements',
      ],
      href: '/developer/catalog',
    });

    systems.push({
      code: 'banks',
      name: 'Bank integration',
      group: 'PAYMENTS',
      status: bankConfigured ? 'DEGRADED' : 'NOT_CONFIGURED',
      live: false,
      configured: bankConfigured,
      detail: bankConfigured
        ? 'Bank env present but no host-to-host adapter / statement import is coded'
        : 'No bank host-to-host adapter configured',
      lastActivityAt: iso(lastPayment?.recordedAt ?? null),
      activity24h: 0,
      failures24h: 0,
      evidence: [
        `BANK_API_BASE_URL: ${process.env.BANK_API_BASE_URL?.trim() ? 'set' : 'missing'}`,
        `BANK_API_KEY: ${process.env.BANK_API_KEY?.trim() ? 'set' : 'missing'}`,
        'bank reconciliation imports are deferred',
      ],
      href: '/developer/catalog',
    });

    // ── DEVICES ───────────────────────────────────────────────────────────
    systems.push(
      deviceSystem(
        'biometrics',
        'Biometric devices',
        [
          DeviceType.FINGERPRINT_SCANNER,
          DeviceType.BIOMETRIC_TERMINAL,
          DeviceType.FACE_TERMINAL,
        ],
        '/devices',
      ),
      deviceSystem(
        'rfid',
        'RFID / card readers',
        [DeviceType.RFID_READER, DeviceType.SMART_CARD_READER],
        '/devices',
      ),
      deviceSystem('cctv', 'CCTV cameras', [DeviceType.CCTV_CAMERA], '/cctv'),
      deviceSystem(
        'scanners',
        'QR / barcode scanners',
        [DeviceType.QR_SCANNER, DeviceType.BARCODE_SCANNER],
        '/devices',
      ),
    );

    const vision = health.services.find((s) => s.code === 'vision-ai');
    systems.push({
      code: 'anpr',
      name: 'ANPR / Vision AI',
      group: 'DEVICES',
      status:
        vision?.status === 'ok'
          ? anpr24h > 0
            ? 'CONNECTED'
            : 'IDLE'
          : 'NOT_CONFIGURED',
      live: vision?.status === 'ok',
      configured: vision?.status === 'ok',
      detail:
        vision?.status === 'ok'
          ? `Vision AI reachable — ${anpr24h} plate reads in 24h`
          : vision?.status === 'not_deployed'
            ? `Vision AI is not running in this environment — ANPR stays unwired until VISION_AI_URL points at it`
            : 'Vision AI service unreachable — ANPR events cannot be processed',
      lastActivityAt: iso(lastAnpr?.capturedAt ?? lastDeviceEvent?.receivedAt ?? null),
      activity24h: anpr24h,
      failures24h: 0,
      evidence: [
        `VISION_AI_URL: ${process.env.VISION_AI_URL ?? '(default localhost:8000)'}`,
        `vision-ai probe: ${vision?.status ?? 'unknown'}${vision?.latencyMs != null ? ` ${vision.latencyMs}ms` : ''}`,
        `ANPR captures 24h: ${anpr24h}`,
      ],
      href: '/developer/systems',
    });

    systems.push({
      code: 'mqtt',
      name: 'MQTT device bridge',
      group: 'DEVICES',
      status: 'DEFERRED',
      live: false,
      configured: Boolean(process.env.MQTT_URL?.trim() || process.env.MQTT_WS_URL?.trim()),
      detail: 'Broker env may be set, but the Nest MQTT client is not coded — devices use HTTP / device-api',
      lastActivityAt: iso(lastDeviceEvent?.receivedAt ?? null),
      activity24h: 0,
      failures24h: 0,
      evidence: [
        `MQTT_URL: ${process.env.MQTT_URL?.trim() ? 'set' : 'missing'}`,
        `gateway registry rows: ${gatewayRows.length}`,
        'device traffic arrives over HTTP (device-api / iClock)',
      ],
      href: '/developer/systems',
    });

    // ── DATA ──────────────────────────────────────────────────────────────
    systems.push({
      code: 'export',
      name: 'Data export',
      group: 'DATA',
      status: 'CONNECTED',
      live: true,
      configured: true,
      detail: 'CSV export of integration logs / webhooks / outbox (safe columns, cap 100)',
      lastActivityAt: null,
      activity24h: 0,
      failures24h: 0,
      evidence: ['audited as developer.export.generated', 'no payload columns exported'],
      href: '/developer/export',
    });

    systems.push({
      code: 'import',
      name: 'Data import',
      group: 'DATA',
      status: 'DEFERRED',
      live: false,
      configured: false,
      detail: 'No bulk customer / HR / vehicle CSV import on this portal yet',
      lastActivityAt: null,
      activity24h: 0,
      failures24h: 0,
      evidence: ['deferred — onboarding uses per-record APIs'],
      href: '/developer/catalog',
    });

    const count = (status: ConnectivityStatus) =>
      systems.filter((s) => s.status === status).length;

    const report: ConnectivityReport = {
      generatedAt: new Date().toISOString(),
      windowHours: 24,
      summary: {
        total: systems.length,
        connected: count('CONNECTED'),
        console: count('CONSOLE'),
        idle: count('IDLE'),
        degraded: count('DEGRADED'),
        notConfigured: count('NOT_CONFIGURED'),
        deferred: count('DEFERRED'),
        traffic24h: systems.reduce((n, s) => n + s.activity24h, 0),
        failures24h: systems.reduce((n, s) => n + s.failures24h, 0),
      },
      services: health.services,
      systems,
      notes: [
        'CONNECTED = a real transport is doing the work and responded/received traffic in the last 24h.',
        'CONSOLE = dev adapter: the code path works but nothing leaves the server.',
        'Devices are counted from the registry (status + lastSeenAt), not pinged individually.',
        'DEVELOPER / SUPER_ADMIN / GM / ICT (IT_SUPPORT) can open this portal — browser never holds INTEGRATION_SERVICE_TOKEN.',
      ],
    };

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.connectivity.viewed',
      resourceType: 'DeveloperConnectivity',
      after: {
        connected: report.summary.connected,
        console: report.summary.console,
        degraded: report.summary.degraded,
        deferred: report.summary.deferred,
      },
    });

    return report;
  }

  async listRequestLogs(
    user: AuthUser,
    provider?: string,
    takeRaw?: string | number,
  ) {
    const take = Math.min(
      Math.max(Number(takeRaw) || 50, 1),
      100,
    );
    return this.prisma.integrationRequestLog.findMany({
      where: {
        ...(provider ? { provider } : {}),
        OR: [
          { organizationId: user.organizationId },
          { organizationId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: REQUEST_LOG_SAFE_SELECT,
    });
  }

  async pingProvider(
    code: string,
    user: AuthUser,
  ): Promise<ProviderPingResult> {
    const started = Date.now();
    const sms = resolveSmsTransport();
    const elapsed = () => Date.now() - started;
    let result: ProviderPingResult;

    /**
     * A ping never pretends a vendor accepted a message: for messaging we
     * verify the transport that the dispatcher will actually use (so a
     * console/credentials-missing state is reported, not a fake OK).
     */
    if (/sms$/i.test(code)) {
      if (code === 'console-sms' || sms.provider === 'console') {
        result = {
          code,
          ok: true,
          detail: 'console adapter — messages are logged, not delivered',
          latencyMs: elapsed(),
        };
      } else {
        result = {
          code,
          ok: sms.live,
          detail: sms.live
            ? `${sms.provider} transport configured (sender ${sms.senderId}) — sends on dispatch`
            : `${sms.provider} selected but SMS credentials are incomplete`,
          latencyMs: elapsed(),
        };
      }
    } else if (/-email$/i.test(code) || code === 'email') {
      const provider = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
      const url = Boolean(process.env.EMAIL_API_URL?.trim());
      result = {
        code,
        ok: provider !== '' && provider !== 'console' && url,
        detail:
          provider !== '' && provider !== 'console' && url
            ? `${provider} HTTP transport configured`
            : 'console adapter — emails are logged, not delivered',
        latencyMs: elapsed(),
      };
    } else {
      switch (code) {
        case 'console-payment':
          result = {
            code,
            ok: true,
            detail: 'console adapter — no PSP is called',
            latencyMs: elapsed(),
          };
          break;
        case 'vision-ai-anpr':
        case 'anpr': {
          const vision = await this.probeVisionAi();
          result = {
            code,
            ok: vision.status === 'UP',
            detail: vision.detail,
            latencyMs: elapsed(),
          };
          break;
        }
        case 'whatsapp': {
          const configured = Boolean(
            process.env.WHATSAPP_API_URL?.trim() &&
              process.env.WHATSAPP_API_TOKEN?.trim(),
          );
          result = {
            code,
            ok: false,
            detail: configured
              ? 'env set but the Meta Cloud API sender is not implemented'
              : 'not implemented — WhatsApp channel is disabled',
            latencyMs: elapsed(),
          };
          break;
        }
        default:
          throw new BadRequestException({
            error: 'UNSUPPORTED_PROVIDER_PING',
            message: `No ping is implemented for "${code}". Supported: console-sms, <provider>-sms, console-email, <provider>-email, console-payment, vision-ai-anpr, whatsapp.`,
          });
      }
    }

    await this.writeRequestLog({
      organizationId: user.organizationId,
      provider: code,
      direction: 'OUTBOUND',
      statusCode: result.ok ? 200 : 501,
      durationMs: result.latencyMs ?? Date.now() - started,
      summary: `ping: ${result.detail}`,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.provider.ping',
      resourceType: 'ProviderRegistry',
      resourceId: code,
      after: { ok: result.ok, detail: result.detail },
    });

    return result;
  }

  async listWebhookInbox(user: AuthUser, status?: string, takeRaw?: number) {
    const take = Math.min(Math.max(Number(takeRaw) || 50, 1), 100);
    const whereStatus = status
      ? { status: status as WebhookInboxStatus }
      : {};
    return this.prisma.webhookInbox.findMany({
      where: {
        ...whereStatus,
        OR: [
          { organizationId: user.organizationId },
          { organizationId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });
  }

  async replayWebhook(id: string, user: AuthUser) {
    const row = await this.prisma.webhookInbox.findFirst({
      where: {
        id,
        OR: [
          { organizationId: user.organizationId },
          { organizationId: null },
        ],
      },
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });
    if (!row) throw new NotFoundException('Webhook inbox entry not found');
    if (!WEBHOOK_REPLAYABLE.includes(row.status)) {
      throw new BadRequestException(
        `Cannot replay webhook in status ${row.status} (only FAILED/DLQ)`,
      );
    }

    const updated = await this.prisma.webhookInbox.update({
      where: { id },
      data: {
        status: WebhookInboxStatus.RECEIVED,
        retryCount: 0,
        errorMessage: null,
        processedAt: null,
      },
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.webhook.replay',
      resourceType: 'WebhookInbox',
      resourceId: id,
      before: { status: row.status },
      after: { status: updated.status, provider: updated.provider },
    });

    return updated;
  }

  async listOutbox(user: AuthUser, status?: string, takeRaw?: number) {
    const take = Math.min(Math.max(Number(takeRaw) || 50, 1), 100);
    const statuses: OutboxStatus[] = status
      ? [status as OutboxStatus]
      : [OutboxStatus.PENDING, OutboxStatus.FAILED];

    return this.prisma.integrationOutbox.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: statuses },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: OUTBOX_SAFE_SELECT,
    });
  }

  /** Safe requeue: FAILED or PENDING only → PENDING with nextRetryAt=now. */
  async replayOutbox(id: string, user: AuthUser) {
    const row = await this.prisma.integrationOutbox.findFirst({
      where: { id, organizationId: user.organizationId },
      select: OUTBOX_SAFE_SELECT,
    });
    if (!row) throw new NotFoundException('Outbox entry not found');
    if (
      row.status !== OutboxStatus.FAILED &&
      row.status !== OutboxStatus.PENDING
    ) {
      throw new BadRequestException(
        `Cannot requeue outbox in status ${row.status} (only PENDING/FAILED)`,
      );
    }

    const updated = await this.prisma.integrationOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.PENDING,
        nextRetryAt: new Date(),
        errorMessage: null,
      },
      select: OUTBOX_SAFE_SELECT,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.outbox.replay',
      resourceType: 'IntegrationOutbox',
      resourceId: id,
      before: { status: row.status },
      after: { status: updated.status, eventType: updated.eventType },
    });

    return updated;
  }

  /** Portal 35.24 — design topics vs honest wiring (no fake vendor UP). */
  integrationCatalog() {
    return {
      generatedAt: new Date().toISOString(),
      topics: [
        {
          id: 'apis',
          name: 'APIs',
          status: 'WIRED',
          note: 'Swagger on core-api / integration / reporting / realtime. Browser uses JWT on :4001, never the integration service token.',
        },
        {
          id: 'webhooks',
          name: 'Webhooks',
          status: 'WIRED',
          note: 'Inbox + replay FAILED/DLQ. Payment webhook path on integration-gateway (service-token).',
        },
        {
          id: 'environments',
          name: 'System environments',
          status: 'WIRED',
          note: 'Non-secret config / broker flags. Secrets never returned.',
        },
        {
          id: 'logs',
          name: 'Logs',
          status: 'WIRED',
          note: 'IntegrationRequestLog safe fields only.',
        },
        {
          id: 'testing',
          name: 'Testing',
          status: 'WIRED',
          note: 'Adapter ping: console-sms, console-payment, vision-ai-anpr. WhatsApp ping returns not implemented.',
        },
        {
          id: 'sms',
          name: 'SMS gateways',
          status: 'CONSOLE',
          note: 'ConsoleSmsProvider until vendor adapter is registered.',
        },
        {
          id: 'payment',
          name: 'Payment gateway',
          status: 'CONSOLE',
          note: 'ConsolePaymentProvider. Real PSP/bank webhooks deferred.',
        },
        {
          id: 'mobile-money',
          name: 'Mobile money',
          status: 'DEFERRED',
          note: 'M-Pesa / TigoPesa / Airtel / HaloPesa adapters not registered.',
        },
        {
          id: 'banks',
          name: 'Banks',
          status: 'DEFERRED',
          note: 'No bank host-to-host adapter yet.',
        },
        {
          id: 'whatsapp',
          name: 'WhatsApp API',
          status: 'DEFERRED',
          note: 'Always DISABLED — Meta Cloud API not wired.',
        },
        {
          id: 'anpr',
          name: 'ANPR systems',
          status: 'WIRED',
          note: 'Vision AI health + result ingest. Decide stays parking/ops.',
        },
        {
          id: 'cctv',
          name: 'CCTV systems',
          status: 'WIRED',
          note: 'Device registry + events/metadata. Video stays on NVR. Nest MQTT bridge deferred.',
        },
        {
          id: 'biometrics',
          name: 'Biometric devices',
          status: 'WIRED',
          note: 'Fingerprint / face / terminals in devices registry + iClock/device-api.',
        },
        {
          id: 'rfid',
          name: 'RFID systems',
          status: 'WIRED',
          note: 'RFID_READER / SMART_CARD_READER registry. Barrier MQTT deferred.',
        },
        {
          id: 'export',
          name: 'Data export',
          status: 'WIRED',
          note: 'CSV of logs / webhooks / outbox (safe columns, cap 100).',
        },
        {
          id: 'import',
          name: 'Data import',
          status: 'WIRED',
          note: 'Device registry bulk CSV import with dry-run preview + audit. Customer / HR / payroll spreadsheets stay with their owning portal.',
        },
        {
          id: 'mqtt',
          name: 'MQTT / EMQX',
          status: 'DEFERRED',
          note: 'Broker env may be set; Nest MQTT client is not coded.',
        },
      ],
      notes: [
        'ICT Manager is IT_SUPPORT (helpdesk + integrations.manage) and can open this portal; Super Admin and DEVELOPER (dev1@) always can.',
        'Authorized technical partners use a DEVELOPER-style account — there is no separate API_ADMIN / SYSTEM_INTEGRATOR / TECHNICAL_PARTNER role.',
      ],
    };
  }

  apiSurface() {
    const docs = [
      {
        code: 'core-api',
        name: 'Core API',
        host: this.safeHostname(
          process.env.CORE_API_INTERNAL_URL ?? 'http://localhost:4001',
        ),
        docsPath: '/docs',
        note: 'Domain APIs. JWT. Swagger on this process.',
      },
      {
        code: 'api-gateway',
        name: 'API Gateway',
        host: this.safeHostname(
          process.env.API_GATEWAY_URL ?? 'http://localhost:4000',
        ),
        docsPath: null,
        note: 'Entry proxy — no Swagger. Blocks /internal.',
      },
      {
        code: 'integration-gateway',
        name: 'Integration Gateway',
        host: this.safeHostname(
          process.env.INTEGRATION_GATEWAY_URL ?? 'http://localhost:4003',
        ),
        docsPath: '/docs',
        note: 'Webhooks/adapters. Service token — not from the browser.',
      },
      {
        code: 'reporting-service',
        name: 'Reporting Service',
        host: this.safeHostname(
          process.env.REPORTING_SERVICE_INTERNAL_URL ??
            'http://localhost:4005',
        ),
        docsPath: '/docs',
        note: 'KPIs / exports. reporting.read.',
      },
      {
        code: 'realtime-gateway',
        name: 'Realtime Gateway',
        host: this.safeHostname(
          process.env.REALTIME_GATEWAY_URL ?? 'http://localhost:4004',
        ),
        docsPath: '/docs',
        note: 'SSE events. MQTT Nest client not coded.',
      },
    ];
    return {
      generatedAt: new Date().toISOString(),
      docs,
      prefixes: [
        'auth',
        'users',
        'developer',
        'devices',
        'device-api',
        'notifications',
        'parking',
        'attendance',
        'webhooks (integration-gateway)',
      ],
      notes: [
        'Open /docs on core-api while logged into admin-web as an integrator.',
        'Do not paste INTEGRATION_SERVICE_TOKEN into the browser.',
      ],
    };
  }

  async systemsMonitor(user: AuthUser) {
    const org = user.organizationId;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.device.groupBy({
      by: ['type', 'status'],
      where: { organizationId: org },
      _count: { _all: true },
    });
    const byType: Record<
      string,
      { total: number; online: number }
    > = {};
    for (const row of grouped) {
      const bucket = byType[row.type] ?? { total: 0, online: 0 };
      bucket.total += row._count._all;
      if (row.status === DeviceStatus.ONLINE) bucket.online += row._count._all;
      byType[row.type] = bucket;
    }
    const sumTypes = (types: DeviceType[]) => {
      let total = 0;
      let online = 0;
      for (const t of types) {
        total += byType[t]?.total ?? 0;
        online += byType[t]?.online ?? 0;
      }
      return { total, online };
    };

    const [anprToday, openCctvEvents, mqttDevices] = await Promise.all([
      this.prisma.anprResult.count({
        where: { organizationId: org, capturedAt: { gte: since24h } },
      }),
      this.prisma.deviceEvent.count({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: { in: [DeviceEventStatus.RECEIVED, DeviceEventStatus.FAILED] },
        },
      }),
      this.prisma.device.count({
        where: {
          organizationId: org,
          connection: DeviceConnection.MQTT,
        },
      }),
    ]);

    const result = {
      generatedAt: new Date().toISOString(),
      biometric: sumTypes([
        DeviceType.FINGERPRINT_SCANNER,
        DeviceType.BIOMETRIC_TERMINAL,
        DeviceType.FACE_TERMINAL,
      ]),
      rfid: sumTypes([DeviceType.RFID_READER, DeviceType.SMART_CARD_READER]),
      cctv: sumTypes([DeviceType.CCTV_CAMERA]),
      scanners: sumTypes([DeviceType.QR_SCANNER, DeviceType.BARCODE_SCANNER]),
      byType,
      anprToday,
      openCctvEvents,
      mqttConnectionDevices: mqttDevices,
      nestMqttClient: false,
      notes: [
        'Counts from devices registry + ANPR/CCTV event metadata. Video not via Nest.',
        'Device CRUD stays /devices (operations.manage). ANPR decide stays parking-web.',
        'MQTT connection on a device ≠ Nest MQTT client (still deferred).',
      ],
    };
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.systems.viewed',
      resourceType: 'DeveloperSystems',
      after: {
        biometric: result.biometric.total,
        rfid: result.rfid.total,
        cctv: result.cctv.total,
        anprToday: result.anprToday,
        openCctvEvents: result.openCctvEvents,
      },
    });
    return result;
  }

  async exportPack(
    user: AuthUser,
    kindRaw?: string,
  ): Promise<{ kind: string; filename: string; csv: string; rowCount: number }> {
    const kind = (kindRaw ?? 'logs').toLowerCase();
    let raw: unknown;
    if (kind === 'logs') {
      raw = await this.listRequestLogs(user, undefined, 100);
    } else if (kind === 'webhooks') {
      raw = await this.listWebhookInbox(user, undefined, 100);
    } else if (kind === 'outbox') {
      raw = await this.listOutbox(user, undefined, 100);
    } else {
      throw new BadRequestException({
        error: 'INVALID_EXPORT_KIND',
        message: 'kind must be logs, webhooks, or outbox',
      });
    }
    const parsed = JSON.parse(JSON.stringify(raw));
    const rows = Array.isArray(parsed)
      ? (parsed as Record<string, unknown>[])
      : [];
    const csv = this.toCsv(rows);
    const filename = `pssms-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'developer.export.generated',
      resourceType: 'DeveloperExport',
      after: { kind, rowCount: rows.length },
    });
    return { kind, filename, csv, rowCount: rows.length };
  }

  /**
   * Portal 35.24 — data import. Device registry is the developer-owned master
   * data, so bulk onboarding of biometric / CCTV / RFID / ANPR terminals lives
   * here (customer or HR spreadsheets stay out: those domains own their input).
   *
   * Preview first (`dryRun`), then commit. Never throws on a bad row — the
   * report carries per-line errors so the operator can fix the file.
   */
  async importDevices(
    user: AuthUser,
    csv: string,
    dryRun: boolean,
  ): Promise<DeviceImportReport> {
    const org = user.organizationId;
    const lines = (csv ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException({
        error: 'IMPORT_EMPTY',
        message: 'CSV needs a header row and at least one device row',
      });
    }

    const header = this.splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const required = ['code', 'name', 'type'];
    const missing = required.filter((h) => !header.includes(h));
    if (missing.length) {
      throw new BadRequestException({
        error: 'IMPORT_HEADER_INVALID',
        message: `Missing required column(s): ${missing.join(', ')}. Allowed columns: ${DEVICE_IMPORT_COLUMNS.join(', ')}`,
      });
    }
    const dataLines = lines.slice(1);
    if (dataLines.length > 500) {
      throw new BadRequestException({
        error: 'IMPORT_TOO_LARGE',
        message: `Maximum 500 rows per import (received ${dataLines.length})`,
      });
    }

    const types = Object.values(DeviceType) as string[];
    const connections = Object.values(DeviceConnection) as string[];
    const sites = await this.prisma.site.findMany({
      where: { organizationId: org },
      select: { id: true, code: true, name: true },
    });
    const siteByCode = new Map(sites.map((s) => [s.code.toLowerCase(), s]));
    const existing = await this.prisma.device.findMany({
      where: { organizationId: org },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((d) => d.code.toLowerCase()));

    const rows: DeviceImportRow[] = [];
    const seen = new Set<string>();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < dataLines.length; i += 1) {
      const lineNumber = i + 2;
      const cells = this.splitCsvLine(dataLines[i]!);
      const get = (col: string): string => {
        const idx = header.indexOf(col);
        return idx >= 0 ? (cells[idx] ?? '').trim() : '';
      };
      const code = get('code');
      const name = get('name');
      const typeRaw = get('type').toUpperCase();
      const connectionRaw = (get('connection') || 'NETWORK').toUpperCase();
      const siteCode = get('sitecode') || get('site');

      if (!code || !name) {
        rows.push({
          line: lineNumber,
          code: code || '—',
          action: 'ERROR',
          message: 'code and name are required',
        });
        failed += 1;
        continue;
      }
      if (!types.includes(typeRaw)) {
        rows.push({
          line: lineNumber,
          code,
          action: 'ERROR',
          message: `unknown type "${typeRaw}" — use one of ${types.join(', ')}`,
        });
        failed += 1;
        continue;
      }
      if (!connections.includes(connectionRaw)) {
        rows.push({
          line: lineNumber,
          code,
          action: 'ERROR',
          message: `unknown connection "${connectionRaw}" — use one of ${connections.join(', ')}`,
        });
        failed += 1;
        continue;
      }
      const site = siteCode ? siteByCode.get(siteCode.toLowerCase()) : undefined;
      if (siteCode && !site) {
        rows.push({
          line: lineNumber,
          code,
          action: 'ERROR',
          message: `site code "${siteCode}" not found in this organization`,
        });
        failed += 1;
        continue;
      }
      if (seen.has(code.toLowerCase())) {
        rows.push({
          line: lineNumber,
          code,
          action: 'SKIP',
          message: 'duplicate code in this file',
        });
        skipped += 1;
        continue;
      }
      seen.add(code.toLowerCase());

      const isUpdate = existingCodes.has(code.toLowerCase());
      const payload = {
        name,
        type: typeRaw as DeviceType,
        connection: connectionRaw as DeviceConnection,
        siteId: site?.id ?? null,
        vendor: get('vendor') || null,
        model: get('model') || null,
        serialNumber: get('serialnumber') || get('serial') || null,
      };

      if (dryRun) {
        rows.push({
          line: lineNumber,
          code,
          action: isUpdate ? 'UPDATE' : 'CREATE',
          message: isUpdate
            ? 'existing code — metadata will be overwritten'
            : site
              ? `new device at ${site.code}`
              : 'new device (no site)',
        });
        if (isUpdate) updated += 1;
        else created += 1;
        continue;
      }

      try {
        if (isUpdate) {
          await this.prisma.device.update({
            where: { organizationId_code: { organizationId: org, code } },
            data: payload,
          });
          updated += 1;
          rows.push({ line: lineNumber, code, action: 'UPDATE' });
        } else {
          await this.prisma.device.create({
            data: {
              organizationId: org,
              code,
              ...payload,
              status: DeviceStatus.PENDING,
              createdBy: user.id,
            },
          });
          existingCodes.add(code.toLowerCase());
          created += 1;
          rows.push({ line: lineNumber, code, action: 'CREATE' });
        }
      } catch (err) {
        failed += 1;
        rows.push({
          line: lineNumber,
          code,
          action: 'ERROR',
          message: String(err).slice(0, 200),
        });
      }
    }

    const report: DeviceImportReport = {
      kind: 'devices',
      dryRun,
      total: dataLines.length,
      created,
      updated,
      skipped,
      failed,
      rows,
      importedAt: new Date().toISOString(),
    };
    if (!dryRun) {
      await this.audit.record({
        organizationId: org,
        actorId: user.id,
        action: 'developer.import.devices',
        resourceType: 'DeveloperImport',
        after: {
          total: report.total,
          created: report.created,
          updated: report.updated,
          skipped: report.skipped,
          failed: report.failed,
        },
      });
    }
    return report;
  }

  /** Column contract for the import screen (so the UI never guesses). */
  importOptions() {
    return {
      kind: 'devices',
      entity: 'Device registry',
      columns: DEVICE_IMPORT_COLUMNS,
      required: ['code', 'name', 'type'],
      deviceTypes: Object.values(DeviceType),
      connections: Object.values(DeviceConnection),
      sample: [
        'code,name,type,connection,siteCode,vendor,model,serialNumber',
        'BIO-GATE-02,Gate 2 fingerprint,BIOMETRIC_TERMINAL,NETWORK,SITE-WAREHOUSE-A,ZKTeco,F18,SN-0002',
      ].join('\n'),
      notes: [
        'Existing device code updates its metadata — no duplicate rows are created.',
        'New devices start as PENDING until the device authenticates.',
        'Maximum 500 rows per file. Customers / HR / payroll spreadsheets are out of scope here.',
      ],
    };
  }

  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  private toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return 'id\n';
    const keys = Object.keys(rows[0] ?? { id: true });
    const header = keys.join(',');
    const lines = rows.map((row) =>
      keys
        .map((k) => {
          const v = row[k];
          const s =
            v == null
              ? ''
              : v instanceof Date
                ? v.toISOString()
                : String(v);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  private ensureWhatsAppHonesty(
    adapters: ProviderHealthItem[],
  ): ProviderHealthItem[] {
    const next = adapters.map((a) => {
      if (
        a.code === 'whatsapp' ||
        a.code.startsWith('whatsapp') ||
        a.category === 'WHATSAPP'
      ) {
        return {
          ...a,
          status: 'DISABLED',
          isEnabled: false,
          detail: a.detail ?? 'not implemented',
        };
      }
      return a;
    });
    const hasWhatsApp = next.some(
      (a) => a.code === 'whatsapp' || a.category === 'WHATSAPP',
    );
    if (!hasWhatsApp) {
      next.push({
        code: 'whatsapp',
        category: 'WHATSAPP',
        status: 'DISABLED',
        adapterClass: 'WhatsAppAdapter',
        isEnabled: false,
        detail: 'not implemented',
      });
    }
    return next;
  }

  private async writeRequestLog(params: {
    organizationId?: string | null;
    provider: string;
    direction: string;
    statusCode?: number | null;
    durationMs?: number | null;
    summary?: string;
    correlationId?: string;
  }) {
    try {
      await this.prisma.integrationRequestLog.create({
        data: {
          organizationId: params.organizationId || null,
          provider: params.provider,
          direction: params.direction,
          statusCode: params.statusCode ?? null,
          durationMs: params.durationMs ?? null,
          summary: params.summary?.slice(0, 500) ?? null,
          correlationId: params.correlationId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`IntegrationRequestLog write failed: ${String(err)}`);
    }
  }

  /** Hostname (+port) only — never credentials embedded in URLs. */
  private safeHostname(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    try {
      const u = new URL(raw);
      return u.host || null;
    } catch {
      // host:port without scheme
      const cleaned = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0];
      return cleaned?.includes('@')
        ? (cleaned.split('@').pop() ?? null)
        : cleaned || null;
    }
  }

  private async probeRedisTcp(): Promise<boolean> {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = Number(process.env.REDIS_PORT ?? 6379);
    return new Promise((resolve) => {
      const socket = new Socket();
      const done = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1500);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
      try {
        socket.connect(port, host);
      } catch {
        done(false);
      }
    });
  }

  private async probeService(target: ProbeTarget): Promise<ServiceHealthItem> {
    const configured = process.env[target.envUrl];
    const base = configured ?? target.defaultUrl;
    const publicUrl = this.safeHostname(base) ?? 'configured';
    const absent = this.absentServices();
    const loopback = /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(base);

    // An explicitly-absent service, or one still pointing at localhost in a
    // production deploy, is not part of this environment — say so instead of
    // pretending it is broken ("down").
    if (absent.includes(target.code)) {
      return {
        code: target.code,
        name: target.name,
        url: publicUrl,
        path: target.path,
        status: 'not_deployed',
        latencyMs: null,
        detail: 'Not deployed in this environment (PLATFORM_ABSENT_SERVICES)',
      };
    }
    // A loopback default with no env override means the platform was never
    // told where this service lives — in any environment, not just prod.
    if (!configured && loopback) {
      return {
        code: target.code,
        name: target.name,
        url: publicUrl,
        path: target.path,
        status: 'not_deployed',
        latencyMs: null,
        detail: `No ${target.envUrl} configured — not part of this deployment`,
      };
    }

    const url = `${base.replace(/\/$/, '')}${target.path}`;
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        // 5xx = our service answered but is unhealthy → real outage.
        // 4xx = the route does not exist there, so a different application is
        // answering; that service simply is not deployed at this URL.
        if (res.status >= 500) {
          return {
            code: target.code,
            name: target.name,
            url: publicUrl,
            path: target.path,
            status: 'down',
            latencyMs,
            detail: `HTTP ${res.status}`,
          };
        }
        return {
          code: target.code,
          name: target.name,
          url: publicUrl,
          path: target.path,
          status: 'not_deployed',
          latencyMs,
          detail: `Not running here — HTTP ${res.status} at ${base} is a different application, not ${target.name}`,
        };
      }
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        data?: { status?: string };
        service?: string;
      };
      const statusRaw = json.data?.status ?? json.status ?? 'ok';
      const ok = String(statusRaw).toLowerCase() !== 'down';
      return {
        code: target.code,
        name: target.name,
        url: publicUrl,
        path: target.path,
        status: ok ? 'ok' : 'down',
        latencyMs,
        detail: json.service ?? String(statusRaw),
      };
    } catch {
      const latencyMs = Date.now() - started;
      // A loopback address always means "this machine", so a refused
      // connection is "not started here", not an outage. Flagging it red made
      // a healthy laptop install look broken.
      if (loopback) {
        return {
          code: target.code,
          name: target.name,
          url: publicUrl,
          path: target.path,
          status: 'not_deployed',
          latencyMs,
          detail: `Not running here — nothing is listening at ${base}${
            configured ? '' : ` (and no ${target.envUrl} is configured)`
          }`,
        };
      }
      return {
        code: target.code,
        name: target.name,
        url: publicUrl,
        path: target.path,
        status: 'down',
        latencyMs,
        detail: 'unreachable',
      };
    }
  }

  /** Comma-separated service codes this deployment deliberately omits. */
  private absentServices(): string[] {
    return (process.env.PLATFORM_ABSENT_SERVICES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }


  private async providersHealthFallback(): Promise<ProviderHealthItem[]> {
    const registered = await this.prisma.providerRegistry.findMany({
      orderBy: { code: 'asc' },
    });
    const rows =
      registered.length > 0
        ? registered
        : [
            {
              code: 'console-sms',
              category: 'SMS' as const,
              adapterClass: 'ConsoleSmsProvider',
              isEnabled: true,
            },
            {
              code: 'console-payment',
              category: 'PAYMENT' as const,
              adapterClass: 'ConsolePaymentProvider',
              isEnabled: true,
            },
            {
              code: 'vision-ai-anpr',
              category: 'ANPR' as const,
              adapterClass: 'VisionAiAnprAdapter',
              isEnabled: true,
            },
          ];

    const vision = await this.probeVisionAi();
    return rows.map((p) => {
      if (!p.isEnabled) {
        return {
          code: p.code,
          category: String(p.category),
          status: 'DISABLED',
          adapterClass: p.adapterClass,
          isEnabled: false,
        };
      }
      if (p.code === 'vision-ai-anpr' || String(p.category) === 'ANPR') {
        return {
          code: p.code,
          category: String(p.category),
          status: vision.status,
          adapterClass: p.adapterClass,
          isEnabled: true,
          detail: vision.detail,
        };
      }
      // Console / in-process adapters — UP when enabled (no external dependency).
      return {
        code: p.code,
        category: String(p.category),
        status: 'UP',
        adapterClass: p.adapterClass,
        isEnabled: true,
        detail: 'in-process',
      };
    });
  }

  private async probeVisionAi(): Promise<{ status: string; detail: string }> {
    const base = process.env.VISION_AI_URL ?? 'http://localhost:8000';
    const host = this.safeHostname(base) ?? 'vision-ai';
    const loopback = /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(base);
    const notDeployed = (why: string) => ({
      status: 'NOT_DEPLOYED',
      detail: `Vision AI is not running in this environment (${why}) — ANPR cannot process captures`,
    });
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        // 5xx = our service answered and is sick. 4xx = another app owns the port.
        return res.status >= 500
          ? { status: 'DOWN', detail: `HTTP ${res.status}` }
          : notDeployed(
              `HTTP ${res.status} at ${host} is a different application`,
            );
      }
      return { status: 'UP', detail: host };
    } catch {
      return loopback
        ? notDeployed(`nothing is listening at ${host}`)
        : { status: 'DOWN', detail: 'unreachable' };
    }
  }
}
