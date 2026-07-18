import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { KpiPeriodGranularity } from '@prisma/client';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { DashboardService } from '../application/dashboard.service';
import { KpiService } from '../application/kpi.service';
import { AnalyticsBridgeService } from '../application/analytics-bridge.service';
import { ExportService } from '../application/export.service';
import {
  AnomalyInsightDto,
  AnalyticsInsightResponseDto,
  ExecutiveDashboardQueryDto,
  ExecutiveDashboardResponseDto,
  ForecastInsightDto,
  KpiItemDto,
  RefreshKpisDto,
  ReportingHealthDto,
} from './dto/reporting.dto';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly kpis: KpiService,
    private readonly analytics: AnalyticsBridgeService,
    private readonly exports: ExportService,
  ) {}

  @Get('exports/executive-dashboard.xlsx')
  @ApiOperation({ summary: 'Export executive dashboard KPIs as Excel' })
  async exportExecutiveXlsx(
    @Query() query: ExecutiveDashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer, filename } = await this.exports.executiveDashboardXlsx(
      query,
      user,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('exports/executive-dashboard.pdf')
  @ApiOperation({ summary: 'Export executive dashboard KPIs as PDF' })
  async exportExecutivePdf(
    @Query() query: ExecutiveDashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { buffer, filename } = await this.exports.executiveDashboardPdf(
      query,
      user,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('exports/executive-dashboard.csv')
  @ApiOperation({ summary: 'Export executive dashboard KPIs as CSV' })
  async exportExecutiveCsv(
    @Query() query: ExecutiveDashboardQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() reply: FastifyReply,
  ) {
    const csv = await this.exports.executiveDashboardCsv(query, user);
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="executive-dashboard-${date}.csv"`,
      )
      .send(csv);
  }

  @Get('health')
  @ApiOperation({ summary: 'Reporting + analytics-ai health' })
  @ApiOkResponse({ type: ReportingHealthDto })
  async health(): Promise<ReportingHealthDto> {
    const analyticsAi = await this.analytics.health();
    return {
      status: analyticsAi.status === 'up' ? 'ok' : 'degraded',
      service: 'reporting',
      analyticsAi,
    };
  }

  @Get('dashboards/executive')
  @ApiOperation({ summary: 'Executive home dashboard KPIs' })
  @ApiOkResponse({ type: ExecutiveDashboardResponseDto })
  executive(
    @Query() query: ExecutiveDashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboard.executive(query, user);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'List KPIs (optional code filter)' })
  @ApiQuery({ name: 'codes', required: false, description: 'Comma-separated' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [KpiItemDto] })
  async listKpis(
    @CurrentUser() user: AuthUser,
    @Query('codes') codes?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('siteId') siteId?: string,
  ) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    const codeList = codes
      ? codes.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined;
    return this.kpis.computeAll(user.organizationId, fromDate, toDate, codeList, {
      siteId,
    });
  }

  @Get('kpis/:code')
  @ApiOperation({ summary: 'Single KPI detail' })
  async getKpi(
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    const items = await this.kpis.computeAll(
      user.organizationId,
      fromDate,
      toDate,
      [code],
    );
    return items[0] ?? null;
  }

  @Post('kpis/refresh')
  @ApiOperation({ summary: 'Recompute KPI snapshots + audit' })
  refresh(@Body() dto: RefreshKpisDto, @CurrentUser() user: AuthUser) {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    return this.kpis.refresh(
      {
        from,
        to,
        codes: dto.codes,
        granularity: dto.granularity ?? KpiPeriodGranularity.DAY,
      },
      user,
    );
  }

  @Get('snapshots')
  @ApiOperation({ summary: 'List stored KPI snapshots' })
  @ApiQuery({ name: 'kpiCode', required: false })
  snapshots(
    @CurrentUser() user: AuthUser,
    @Query('kpiCode') kpiCode?: string,
  ) {
    return this.kpis.listSnapshots(user.organizationId, kpiCode);
  }

  @Get('insights')
  @ApiOperation({ summary: 'List analytics insights' })
  @ApiOkResponse({ type: [AnalyticsInsightResponseDto] })
  insights(@CurrentUser() user: AuthUser) {
    return this.analytics.listInsights(user.organizationId);
  }

  @Post('insights/forecast')
  @ApiOperation({ summary: 'Request payroll forecast (analytics-ai stub)' })
  @ApiOkResponse({ type: AnalyticsInsightResponseDto })
  forecast(@Body() dto: ForecastInsightDto, @CurrentUser() user: AuthUser) {
    return this.analytics.forecastPayroll(user, dto.horizonMonths ?? 3);
  }

  @Post('insights/anomalies')
  @ApiOperation({ summary: 'Request anomaly detection (analytics-ai stub)' })
  @ApiOkResponse({ type: AnalyticsInsightResponseDto })
  anomalies(@Body() dto: AnomalyInsightDto, @CurrentUser() user: AuthUser) {
    return this.analytics.detectAnomalies(
      user,
      dto.domain ?? 'ATTENDANCE',
      dto.threshold ?? 2,
    );
  }
}
