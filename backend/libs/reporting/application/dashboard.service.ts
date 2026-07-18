import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { KpiPeriodGranularity, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { KpiService } from './kpi.service';
import { AnalyticsBridgeService } from './analytics-bridge.service';
import {
  ExecutiveDashboardQueryDto,
  ExecutiveDashboardResponseDto,
} from '../presentation/dto/reporting.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpis: KpiService,
    private readonly analytics: AnalyticsBridgeService,
  ) {}

  async executive(
    query: ExecutiveDashboardQueryDto,
    user: AuthUser,
  ): Promise<ExecutiveDashboardResponseDto> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    const granularity = query.granularity ?? KpiPeriodGranularity.DAY;
    const filtersHash = createHash('sha256')
      .update(
        JSON.stringify({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          granularity,
          siteId: query.siteId,
          branchId: query.branchId,
        }),
      )
      .digest('hex')
      .slice(0, 16);

    const cached = await this.prisma.withOrgContext(
      user.organizationId,
      (tx) =>
        tx.dashboardCache.findUnique({
          where: {
            organizationId_dashboardCode_filtersHash: {
              organizationId: user.organizationId,
              dashboardCode: 'EXECUTIVE_HOME',
              filtersHash,
            },
          },
        }),
    );

    if (cached && cached.expiresAt > new Date()) {
      const payload = cached.payload as unknown as ExecutiveDashboardResponseDto;
      return {
        ...payload,
        cache: { hit: true, expiresAt: cached.expiresAt },
      };
    }

    const kpis = await this.kpis.computeAll(
      user.organizationId,
      from,
      to,
      undefined,
      { siteId: query.siteId, branchId: query.branchId },
    );

    const insights = await this.analytics.listInsights(user.organizationId);
    const expiresAt = new Date(Date.now() + 60_000);

    const response: ExecutiveDashboardResponseDto = {
      organizationId: user.organizationId,
      generatedAt: new Date(),
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        granularity,
      },
      kpis,
      insights: insights.slice(0, 5) as unknown as Record<string, unknown>[],
      cache: { hit: false, expiresAt },
    };

    await this.prisma.withOrgContext(user.organizationId, (tx) =>
      tx.dashboardCache.upsert({
        where: {
          organizationId_dashboardCode_filtersHash: {
            organizationId: user.organizationId,
            dashboardCode: 'EXECUTIVE_HOME',
            filtersHash,
          },
        },
        update: {
          payload: response as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
        create: {
          organizationId: user.organizationId,
          dashboardCode: 'EXECUTIVE_HOME',
          filtersHash,
          payload: response as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
      }),
    );

    return response;
  }
}
