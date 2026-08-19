import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OutboxStatus, WebhookInboxStatus, DeviceType, DeviceStatus, DeviceEventType, DeviceEventStatus, DeviceConnection } from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService } from '@pssms/shared';
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
  status: 'ok' | 'down';
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
    error?: string;
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
        error: `integration-gateway unreachable: ${String(err)}`,
      };
    }
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
    let result: ProviderPingResult;

    switch (code) {
      case 'console-sms':
        result = {
          code,
          ok: true,
          detail: 'console adapter',
          latencyMs: Date.now() - started,
        };
        break;
      case 'console-payment':
        result = {
          code,
          ok: true,
          detail: 'console adapter',
          latencyMs: Date.now() - started,
        };
        break;
      case 'vision-ai-anpr': {
        const vision = await this.probeVisionAi();
        result = {
          code,
          ok: vision.status === 'UP',
          detail: vision.detail,
          latencyMs: Date.now() - started,
        };
        break;
      }
      case 'whatsapp':
        result = {
          code,
          ok: false,
          detail: 'not implemented',
          latencyMs: Date.now() - started,
        };
        break;
      default:
        throw new BadRequestException(
          `Unknown or unsupported provider code: ${code}`,
        );
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
          status: 'DEFERRED',
          note: 'No bulk customer/HR CSV import on this portal.',
        },
        {
          id: 'mqtt',
          name: 'MQTT / EMQX',
          status: 'DEFERRED',
          note: 'Broker env may be set; Nest MQTT client is not coded.',
        },
      ],
      notes: [
        'ICT Manager IAM stays Super Admin. IT Support is helpdesk (no integrations.manage).',
        'No API_ADMIN / SYSTEM_INTEGRATOR / TECHNICAL_PARTNER roles — use DEVELOPER (dev1@) plus SA/GM.',
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
    const base = process.env[target.envUrl] ?? target.defaultUrl;
    const publicUrl = this.safeHostname(base) ?? 'configured';
    const url = `${base.replace(/\/$/, '')}${target.path}`;
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
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
      return {
        code: target.code,
        name: target.name,
        url: publicUrl,
        path: target.path,
        status: 'down',
        latencyMs: Date.now() - started,
        detail: 'unreachable',
      };
    }
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
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { status: 'DOWN', detail: `HTTP ${res.status}` };
      return { status: 'UP', detail: host };
    } catch {
      return { status: 'DOWN', detail: 'unreachable' };
    }
  }
}
