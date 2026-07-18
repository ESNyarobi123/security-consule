import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

@Injectable()
export class KpiRefreshJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KpiRefreshJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRunKey?: string;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.KPI_REFRESH_ENABLED !== 'true') {
      this.logger.log('KPI refresh job disabled (KPI_REFRESH_ENABLED != true)');
      return;
    }
    this.timer = setInterval(() => void this.maybeRun(), 60_000);
    this.logger.log('KPI refresh job scheduled');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async maybeRun() {
    if (!this.isDue()) return;
    if (this.running) return;

    this.running = true;
    const coreUrl =
      process.env.REPORTING_SERVICE_INTERNAL_URL ??
      process.env.CORE_API_INTERNAL_URL ??
      'http://localhost:4005';
    const token =
      process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';

    try {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true },
      });

      for (const org of orgs) {
        const res = await fetch(
          `${coreUrl}/api/v1/internal/v1/reporting/kpi-refresh`,
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
          throw new Error(
            `KPI refresh failed for org ${org.id}: ${res.status} ${await res.text()}`,
          );
        }
        const body = (await res.json()) as { data?: { refreshed?: number } };
        const refreshed = body.data?.refreshed ?? 0;
        this.logger.log(`KPI refresh org ${org.id}: ${refreshed} snapshots`);
      }

      this.lastRunKey = this.runKey();
      this.logger.log(`KPI refresh completed for ${orgs.length} organization(s)`);
    } catch (err) {
      this.logger.warn(`KPI refresh job failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private isDue(): boolean {
    const intervalMs = Number(process.env.KPI_REFRESH_INTERVAL_MS ?? '0');
    if (intervalMs > 0) {
      const last = this.lastRunKey ? Number(this.lastRunKey) : 0;
      return Date.now() - last >= intervalMs;
    }

    const hour = Number(process.env.KPI_REFRESH_UTC_HOUR ?? '21');
    const minute = Number(process.env.KPI_REFRESH_UTC_MINUTE ?? '5');
    const now = new Date();
    const key = `${now.toISOString().slice(0, 10)}-${hour}-${minute}`;
    if (this.lastRunKey === key) return false;

    return (
      now.getUTCHours() === hour &&
      now.getUTCMinutes() >= minute &&
      now.getUTCMinutes() < minute + 2
    );
  }

  private runKey(): string {
    const intervalMs = Number(process.env.KPI_REFRESH_INTERVAL_MS ?? '0');
    if (intervalMs > 0) return String(Date.now());

    const hour = Number(process.env.KPI_REFRESH_UTC_HOUR ?? '21');
    const minute = Number(process.env.KPI_REFRESH_UTC_MINUTE ?? '5');
    const now = new Date();
    return `${now.toISOString().slice(0, 10)}-${hour}-${minute}`;
  }
}
