import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

/**
 * Periodically marks past-due SCHEDULED alertness checks as MISSED + FieldAlert.
 * Enable with ALERTNESS_MISS_SCAN_ENABLED=true (interval default 5m).
 */
@Injectable()
export class AlertnessMissJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertnessMissJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.ALERTNESS_MISS_SCAN_ENABLED !== 'true') {
      this.logger.log(
        'Alertness miss scan disabled (ALERTNESS_MISS_SCAN_ENABLED != true)',
      );
      return;
    }
    const intervalMs = Number(
      process.env.ALERTNESS_MISS_SCAN_INTERVAL_MS ?? `${5 * 60 * 1000}`,
    );
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.logger.log(`Alertness miss scan scheduled every ${intervalMs}ms`);
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
    const graceMinutes = Number(
      process.env.ALERTNESS_MISS_GRACE_MINUTES ?? '0',
    );

    try {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true, code: true },
      });

      for (const org of orgs) {
        const res = await fetch(
          `${coreUrl}/api/v1/internal/v1/attendance/alertness/scan-missed`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              organizationId: org.id,
              graceMinutes: Number.isFinite(graceMinutes) ? graceMinutes : 0,
            }),
          },
        );
        if (!res.ok) {
          this.logger.warn(
            `Alertness miss scan failed for ${org.code}: ${res.status} ${await res.text()}`,
          );
          continue;
        }
        const json = (await res.json()) as {
          data?: { markedMissed?: number };
        };
        this.logger.log(
          `Alertness miss ${org.code}: marked=${json.data?.markedMissed ?? 0}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Alertness miss scan failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
