import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@pssms/shared';
import { OutboxPollerJob } from './jobs/outbox-poller.job';
import { WebhookProcessorJob } from './jobs/webhook-processor.job';
import { KpiRefreshJob } from './jobs/kpi-refresh.job';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [HealthController],
  providers: [OutboxPollerJob, WebhookProcessorJob, KpiRefreshJob],
})
export class AppModule {}
