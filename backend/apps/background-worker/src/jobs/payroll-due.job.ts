import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

/**
 * Asks core-api to raise e-payroll due alerts (1st of next month, invoice fully paid).
 * Enable with PAYROLL_DUE_ALERT_ENABLED=true (interval default 1h).
 */
@Injectable()
export class PayrollDueJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayrollDueJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.PAYROLL_DUE_ALERT_ENABLED !== 'true') {
      this.logger.log(
        'Payroll due alert scan disabled (PAYROLL_DUE_ALERT_ENABLED != true)',
      );
      return;
    }
    const intervalMs = Number(
      process.env.PAYROLL_DUE_ALERT_INTERVAL_MS ?? `${60 * 60 * 1000}`,
    );
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.logger.log(`Payroll due alert scan scheduled every ${intervalMs}ms`);
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

    try {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true, code: true },
      });

      for (const org of orgs) {
        const res = await fetch(
          `${coreUrl}/api/v1/internal/v1/payroll/scan-due-alerts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ organizationId: org.id }),
          },
        );
        if (!res.ok) {
          this.logger.warn(
            `Payroll due scan failed for ${org.code}: ${res.status} ${await res.text()}`,
          );
          continue;
        }
        const json = (await res.json()) as {
          data?: { alertsCreated?: number; skippedUnpaid?: number };
        };
        this.logger.log(
          `Payroll due ${org.code}: created=${json.data?.alertsCreated ?? 0} unpaid=${json.data?.skippedUnpaid ?? 0}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Payroll due scan failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
