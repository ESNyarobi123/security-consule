import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { PayrollCycleStatus } from '@prisma/client';
import { AnalyticsInsightResponseDto } from '../presentation/dto/reporting.dto';

@Injectable()
export class AnalyticsBridgeService {
  private readonly logger = new Logger(AnalyticsBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  getAnalyticsUrl(): string {
    return (
      this.config.get<string>('ANALYTICS_AI_URL') ?? 'http://localhost:8001'
    );
  }

  async health(): Promise<{ status: string; url: string }> {
    const url = this.getAnalyticsUrl();
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return { status: 'up', url };
      return { status: 'degraded', url };
    } catch {
      return { status: 'down', url };
    }
  }

  async forecastPayroll(
    user: AuthUser,
    horizonMonths = 3,
  ): Promise<AnalyticsInsightResponseDto> {
    const history = await this.buildPayrollHistory(user.organizationId);
    const url = this.getAnalyticsUrl();
    let payload: Record<string, unknown>;

    try {
      const res = await fetch(`${url}/v1/forecast/payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organizationId,
          history,
          horizon_months: horizonMonths,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`analytics-ai ${res.status}`);
      payload = (await res.json()) as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(`Forecast stub fallback: ${String(err)}`);
      const last = history.length ? history[history.length - 1].net_pay_total : 0;
      payload = {
        series: Array.from({ length: horizonMonths }, (_, i) => ({
          period: `M+${i + 1}`,
          predicted_net_pay: Math.round(last * Math.pow(1.02, i + 1)),
        })),
        model: 'stub-linear-fallback',
        confidence: 0.5,
      };
    }

    const insight = await this.prisma.withOrgContext(
      user.organizationId,
      (tx) =>
        tx.analyticsInsight.create({
          data: {
            organizationId: user.organizationId,
            insightType: 'FORECAST',
            domain: 'PAYROLL',
            title: 'Payroll net forecast',
            summary: `Stub forecast for next ${horizonMonths} month(s) based on PayslipSnapshot history`,
            score: new Prisma.Decimal(
              typeof payload.confidence === 'number' ? payload.confidence : 0.7,
            ),
            payload: payload as Prisma.InputJsonValue,
            createdBy: user.id,
          },
        }),
    );

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'reporting.insight.forecast',
      resourceType: 'AnalyticsInsight',
      resourceId: insight.id,
      after: insight,
    });

    return this.toDto(insight);
  }

  async detectAnomalies(
    user: AuthUser,
    domain = 'ATTENDANCE',
    threshold = 2,
  ): Promise<AnalyticsInsightResponseDto> {
    const points = await this.buildAttendanceSeries(user.organizationId);
    const url = this.getAnalyticsUrl();
    let payload: Record<string, unknown>;

    try {
      const res = await fetch(`${url}/v1/anomalies/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organizationId,
          domain,
          points,
          threshold,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`analytics-ai ${res.status}`);
      payload = (await res.json()) as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(`Anomaly stub fallback: ${String(err)}`);
      payload = {
        anomalies: [],
        model: 'stub-zscore-fallback',
        points_analyzed: points.length,
      };
    }

    const anomalies = Array.isArray(payload.anomalies)
      ? payload.anomalies
      : [];
    const insight = await this.prisma.withOrgContext(
      user.organizationId,
      (tx) =>
        tx.analyticsInsight.create({
          data: {
            organizationId: user.organizationId,
            insightType: 'ANOMALY',
            domain,
            title: `${domain} anomaly scan`,
            summary: `Detected ${anomalies.length} anomalous point(s) (stub)`,
            score: new Prisma.Decimal(anomalies.length > 0 ? 0.8 : 0.2),
            payload: payload as Prisma.InputJsonValue,
            createdBy: user.id,
          },
        }),
    );

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'reporting.insight.anomaly',
      resourceType: 'AnalyticsInsight',
      resourceId: insight.id,
      after: insight,
    });

    return this.toDto(insight);
  }

  async listInsights(organizationId: string) {
    const rows = await this.prisma.withOrgContext(organizationId, (tx) =>
      tx.analyticsInsight.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
    return rows.map((r) => this.toDto(r));
  }

  private async buildPayrollHistory(organizationId: string) {
    const cycles = await this.prisma.payrollCycle.findMany({
      where: {
        organizationId,
        status: {
          in: [PayrollCycleStatus.APPROVED, PayrollCycleStatus.PAID],
        },
      },
      orderBy: { periodStart: 'asc' },
      take: 12,
      include: {
        payslips: {
          where: { supersededById: null },
          select: { netPay: true },
        },
      },
    });

    return cycles.map((c) => ({
      period: c.periodStart.toISOString().slice(0, 10),
      net_pay_total: c.payslips.reduce((s, p) => s + Number(p.netPay), 0),
    }));
  }

  private async buildAttendanceSeries(organizationId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const rows = await this.prisma.guardAttendance.groupBy({
      by: ['clockInAt'],
      where: {
        organizationId,
        clockInAt: { gte: since },
      },
      _count: { _all: true },
    });

    // Collapse by day
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const day = r.clockInAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + r._count._all);
    }
    return [...byDay.entries()].map(([t, value]) => ({ t, value }));
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    insightType: string;
    domain: string;
    title: string;
    summary: string;
    score: Prisma.Decimal | null;
    payload: Prisma.JsonValue;
    createdAt: Date;
  }): AnalyticsInsightResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      insightType: row.insightType,
      domain: row.domain,
      title: row.title,
      summary: row.summary,
      score: row.score ? Number(row.score) : null,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
    };
  }
}
