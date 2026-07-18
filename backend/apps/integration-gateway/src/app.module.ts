import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@pssms/shared';
import { ConsoleSmsProvider } from './adapters/messaging/console-sms.provider';
import { ConsolePaymentProvider } from './adapters/payments/console-payment.provider';
import { VisionAiAnprAdapter } from './adapters/anpr/vision-ai-anpr.adapter';
import { DispatchService } from './dispatch/dispatch.service';
import { WebhookInboxService } from './webhooks/webhook-inbox.service';
import { IclockController } from './iclock/iclock.controller';
import { IclockService } from './iclock/iclock.service';
import {
  HealthController,
  InternalDispatchController,
  ProvidersHealthController,
  WebhookInboxController,
  WebhooksController,
} from './webhooks/webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
  ],
  controllers: [
    WebhooksController,
    WebhookInboxController,
    InternalDispatchController,
    HealthController,
    ProvidersHealthController,
    IclockController,
  ],
  providers: [
    WebhookInboxService,
    DispatchService,
    ConsoleSmsProvider,
    ConsolePaymentProvider,
    VisionAiAnprAdapter,
    IclockService,
  ],
  exports: [WebhookInboxService, DispatchService],
})
export class AppModule {}
