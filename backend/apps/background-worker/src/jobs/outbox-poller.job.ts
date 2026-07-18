import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '@pssms/shared';

@Injectable()
export class OutboxPollerJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPollerJob.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 5000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const rows = await this.prisma.integrationOutbox.findMany({
      where: {
        status: OutboxStatus.PENDING,
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const row of rows) {
      try {
        await this.dispatch(row.id, row.aggregateId);
      } catch (err) {
        const retryCount = row.retryCount + 1;
        const delayMs = Math.min(300000, 30000 * 2 ** retryCount);
        await this.prisma.integrationOutbox.update({
          where: { id: row.id },
          data: {
            retryCount,
            nextRetryAt: new Date(Date.now() + delayMs),
            errorMessage: String(err),
            status: retryCount >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          },
        });
        this.logger.warn(`Outbox ${row.id} failed: ${String(err)}`);
      }
    }
  }

  private async dispatch(outboxId: string, aggregateId: string) {
    const baseUrl =
      process.env.INTEGRATION_GATEWAY_URL ?? 'http://localhost:4003';
    const token = process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';
    const res = await fetch(`${baseUrl}/api/v1/internal/v1/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: 'outbox', id: aggregateId }),
    });
    if (!res.ok) {
      throw new Error(`Dispatch failed ${res.status}: ${await res.text()}`);
    }
    this.logger.log(`Outbox dispatched ${outboxId}`);
  }
}
