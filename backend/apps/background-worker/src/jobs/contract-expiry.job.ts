import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

/**
 * Periodically asks core-api to mark ACTIVE→EXPIRING and queue EMAIL reminders.
 * Enable with CONTRACT_EXPIRY_SCAN_ENABLED=true (interval default 1h).
 */
@Injectable()
export class ContractExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContractExpiryJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.CONTRACT_EXPIRY_SCAN_ENABLED !== 'true') {
      this.logger.log(
        'Contract expiry scan disabled (CONTRACT_EXPIRY_SCAN_ENABLED != true)',
      );
      return;
    }
    const intervalMs = Number(
      process.env.CONTRACT_EXPIRY_SCAN_INTERVAL_MS ?? `${60 * 60 * 1000}`,
    );
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.logger.log(`Contract expiry scan scheduled every ${intervalMs}ms`);
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    if (this.running) return;
    this.running = true;

    const coreUrl =
      process.env.CORE_API_INTERNAL_URL ?? 'http://localhost:4001';
    const token =
      process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';
    const daysAhead = Number(process.env.CONTRACT_EXPIRY_DAYS_AHEAD ?? '90');

    try {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true, code: true },
      });

      for (const org of orgs) {
        const res = await fetch(
          `${coreUrl}/api/v1/internal/v1/contracts/scan-expiring`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              organizationId: org.id,
              daysAhead: Number.isFinite(daysAhead) ? daysAhead : 90,
            }),
          },
        );
        if (!res.ok) {
          this.logger.warn(
            `Contract expiry scan failed for ${org.code}: ${res.status} ${await res.text()}`,
          );
          continue;
        }
        const json = (await res.json()) as {
          data?: { markedExpiring?: number; notificationsQueued?: number };
        };
        this.logger.log(
          `Contract expiry ${org.code}: marked=${json.data?.markedExpiring ?? 0} emails=${json.data?.notificationsQueued ?? 0}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Contract expiry scan failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
