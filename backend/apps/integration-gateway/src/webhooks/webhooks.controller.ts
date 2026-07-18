import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceTokenGuard } from '@pssms/shared';
import { DispatchService } from '../dispatch/dispatch.service';
import { WebhookInboxService } from '../webhooks/webhook-inbox.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly inbox: WebhookInboxService) {}

  @Post('payments/:provider')
  @ApiOperation({ summary: 'Inbound payment webhook (inbox + ACK)' })
  async paymentWebhook(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.inbox.receive({
      provider,
      eventType: 'payment.received',
      idempotencyKey: idempotencyKey ?? `${provider}-${String(body.externalId ?? Date.now())}`,
      body,
    });
  }

  @Post('anpr/:provider')
  @ApiOperation({ summary: 'Inbound ANPR camera webhook' })
  async anprWebhook(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.inbox.receive({
      provider,
      eventType: 'anpr.captured',
      idempotencyKey: idempotencyKey ?? `${provider}-${String(body.captured_at ?? Date.now())}`,
      body,
    });
  }
}

@ApiTags('Webhooks — Admin')
@ApiBearerAuth()
@Controller('webhooks/inbox')
export class WebhookInboxController {
  constructor(private readonly inbox: WebhookInboxService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook inbox entries' })
  list(@Query('status') status?: string) {
    return this.inbox.list(status);
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Replay failed webhook' })
  replay(@Param('id') id: string) {
    return this.inbox.replay(id);
  }
}

@ApiTags('Internal')
@Controller('internal/v1')
export class InternalDispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post('dispatch')
  @UseGuards(ServiceTokenGuard)
  @ApiOperation({ summary: 'Dispatch outbox/notification (worker only)' })
  dispatchNotification(@Body() body: { type: string; id: string }) {
    return this.dispatch.dispatch(body);
  }

  @Post('anpr/recognize')
  @UseGuards(ServiceTokenGuard)
  @ApiOperation({ summary: 'Proxy ANPR recognize to vision-ai' })
  recognize(@Body() body: Record<string, unknown>) {
    return this.dispatch.recognizeAnpr(body);
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'integration-gateway' };
  }
}

@ApiTags('Providers')
@Controller('providers')
export class ProvidersHealthController {
  @Get('health')
  @ApiOperation({ summary: 'Adapter health registry' })
  health() {
    return {
      adapters: [
        { code: 'console-sms', status: 'UP', category: 'SMS' },
        { code: 'console-payment', status: 'UP', category: 'PAYMENT' },
        { code: 'vision-ai-anpr', status: 'UP', category: 'ANPR' },
      ],
    };
  }
}
