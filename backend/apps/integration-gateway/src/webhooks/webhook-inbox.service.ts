import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WebhookInboxStatus } from '@prisma/client';
import { PrismaService } from '@pssms/shared';

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

/** Replay only failed / DLQ — never re-queue PROCESSED/RECEIVED/PROCESSING. */
const WEBHOOK_REPLAYABLE: WebhookInboxStatus[] = [
  WebhookInboxStatus.FAILED,
  WebhookInboxStatus.DLQ,
];

@Injectable()
export class WebhookInboxService {
  private readonly logger = new Logger(WebhookInboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async receive(params: {
    provider: string;
    eventType: string;
    idempotencyKey: string;
    body: Record<string, unknown>;
    headers?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.webhookInbox.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return { accepted: true, duplicate: true, id: existing.id };
    }

    const verify = process.env.WEBHOOK_VERIFY === 'true';
    const row = await this.prisma.webhookInbox.create({
      data: {
        provider: params.provider,
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        rawBody: params.body as unknown as Prisma.InputJsonValue,
        rawHeaders: params.headers
          ? (params.headers as unknown as Prisma.InputJsonValue)
          : undefined,
        signatureValid: !verify,
        organizationId:
          typeof params.body.organizationId === 'string'
            ? params.body.organizationId
            : undefined,
      },
    });

    this.logger.log(`Webhook stored ${row.id} ${params.eventType}`);
    return { accepted: true, id: row.id };
  }

  async list(status?: string) {
    return this.prisma.webhookInbox.findMany({
      where: status ? { status: status as WebhookInboxStatus } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });
  }

  async replay(id: string) {
    const row = await this.prisma.webhookInbox.findUnique({
      where: { id },
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });
    if (!row) throw new NotFoundException('Webhook inbox entry not found');
    if (!WEBHOOK_REPLAYABLE.includes(row.status)) {
      throw new BadRequestException(
        `Cannot replay webhook in status ${row.status} (only FAILED/DLQ)`,
      );
    }

    return this.prisma.webhookInbox.update({
      where: { id },
      data: {
        status: WebhookInboxStatus.RECEIVED,
        retryCount: 0,
        errorMessage: null,
        processedAt: null,
      },
      select: WEBHOOK_INBOX_SAFE_SELECT,
    });
  }

  async claimPending(limit = 20) {
    const rows = await this.prisma.webhookInbox.findMany({
      where: { status: WebhookInboxStatus.RECEIVED },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const row of rows) {
      await this.prisma.webhookInbox.update({
        where: { id: row.id },
        data: { status: WebhookInboxStatus.PROCESSING },
      });
    }
    return rows;
  }

  async markProcessed(id: string) {
    await this.prisma.webhookInbox.update({
      where: { id },
      data: { status: WebhookInboxStatus.PROCESSED, processedAt: new Date() },
    });
  }

  async markFailed(id: string, error: string) {
    const row = await this.prisma.webhookInbox.findUnique({ where: { id } });
    if (!row) return;
    const retryCount = row.retryCount + 1;
    const status =
      retryCount >= 5 ? WebhookInboxStatus.DLQ : WebhookInboxStatus.RECEIVED;
    await this.prisma.webhookInbox.update({
      where: { id },
      data: { status, retryCount, errorMessage: error },
    });
  }
}
