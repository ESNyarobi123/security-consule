import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@pssms/shared';
import { OutboxPollerJob } from './jobs/outbox-poller.job';
import { WebhookProcessorJob } from './jobs/webhook-processor.job';
import { KpiRefreshJob } from './jobs/kpi-refresh.job';
import { ContractExpiryJob } from './jobs/contract-expiry.job';
import { InvoiceOverdueJob } from './jobs/invoice-overdue.job';
import { AlertnessMissJob } from './jobs/alertness-miss.job';
import { PatrolMissJob } from './jobs/patrol-miss.job';
import { PayrollDueJob } from './jobs/payroll-due.job';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [HealthController],
  providers: [
    OutboxPollerJob,
    WebhookProcessorJob,
    KpiRefreshJob,
    ContractExpiryJob,
    InvoiceOverdueJob,
    AlertnessMissJob,
    PatrolMissJob,
    PayrollDueJob,
  ],
})
export class AppModule {}
