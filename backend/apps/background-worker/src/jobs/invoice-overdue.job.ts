import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

/**
 * Periodically asks core-api to mark past-due SENT/PARTIALLY_PAID → OVERDUE.
 * Enable with INVOICE_OVERDUE_SCAN_ENABLED=true (interval default 1h).
 */
@Injectable()
export class InvoiceOverdueJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceOverdueJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.INVOICE_OVERDUE_SCAN_ENABLED !== 'true') {
      this.logger.log(
        'Invoice overdue scan disabled (INVOICE_OVERDUE_SCAN_ENABLED != true)',
      );
      return;
    }
    const intervalMs = Number(
      process.env.INVOICE_OVERDUE_SCAN_INTERVAL_MS ?? `${60 * 60 * 1000}`,
    );
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.logger.log(`Invoice overdue scan scheduled every ${intervalMs}ms`);
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
          `${coreUrl}/api/v1/internal/v1/finance/invoices/scan-overdue`,
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
            `Invoice overdue scan failed for ${org.code}: ${res.status} ${await res.text()}`,
          );
          continue;
        }
        const json = (await res.json()) as {
          data?: { markedOverdue?: number };
        };
        this.logger.log(
          `Invoice overdue ${org.code}: marked=${json.data?.markedOverdue ?? 0}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Invoice overdue scan failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
