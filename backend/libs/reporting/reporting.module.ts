import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { KpiService } from './application/kpi.service';
import { DashboardService } from './application/dashboard.service';
import { AnalyticsBridgeService } from './application/analytics-bridge.service';
import { ExportService } from './application/export.service';
import { ReportingController } from './presentation/reporting.controller';

@Module({
  imports: [AuditModule],
  controllers: [ReportingController],
  providers: [
    KpiService,
    DashboardService,
    AnalyticsBridgeService,
    ExportService,
  ],
  exports: [KpiService, DashboardService, AnalyticsBridgeService, ExportService],
})
export class ReportingModule {}
