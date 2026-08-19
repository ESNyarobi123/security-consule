import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { DeveloperIntegrationsService } from './developer-integrations.service';

/**
 * Developer & Integration portal (§35.24) — JWT-authenticated read/replay
 * surface on core-api so admin-web never needs browser→:4003 calls.
 *
 * Integration-gateway inbox/providers stay service-token only; this controller
 * either reads shared Prisma tables or proxies with INTEGRATION_SERVICE_TOKEN.
 */
@ApiTags('Developer — Integrations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('integrations.manage')
@Controller('developer')
export class DeveloperIntegrationsController {
  constructor(private readonly service: DeveloperIntegrationsService) {}

  @Get('catalog')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Portal 35.24 design topics vs honest wiring (WIRED / CONSOLE / DEFERRED)',
  })
  catalog() {
    return this.service.integrationCatalog();
  }

  @Get('apis')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Swagger hosts (hostname only) + public API prefix notes',
  })
  apiSurface() {
    return this.service.apiSurface();
  }

  @Get('systems')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Biometric / CCTV / RFID / ANPR registry counts (metadata — no Nest video)',
  })
  systems(@CurrentUser() user: AuthUser) {
    return this.service.systemsMonitor(user);
  }

  @Get('export')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'CSV export of logs, webhooks, or outbox (safe columns, cap 100)',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    description: 'logs | webhooks | outbox (default logs)',
  })
  exportPack(
    @CurrentUser() user: AuthUser,
    @Query('kind') kind?: string,
  ) {
    return this.service.exportPack(user, kind);
  }

  @Get('services/health')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Probe real platform services (core-api, worker, gateways, AI). URLs from env with localhost defaults.',
  })
  @ApiOkResponse({ description: 'Service health list' })
  servicesHealth() {
    return this.service.listPlatformHealth();
  }

  @Get('providers/health')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Adapter health registry (proxies integration-gateway with service token)',
  })
  providersHealth(@CurrentUser() user: AuthUser) {
    return this.service.listProvidersHealth(user);
  }

  @Get('config')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Non-secret env / broker config status (never returns tokens or passwords)',
  })
  configStatus() {
    return this.service.getConfigStatus();
  }

  @Get('logs')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'List IntegrationRequestLog (org + system, max 100, safe fields only)',
  })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'take', required: false, description: '1–100 (default 50)' })
  listLogs(
    @CurrentUser() user: AuthUser,
    @Query('provider') provider?: string,
    @Query('take') take?: string,
  ) {
    return this.service.listRequestLogs(user, provider, take);
  }

  @Post('providers/:code/ping')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary:
      'Test-ping a known adapter (console-sms, console-payment, vision-ai-anpr, whatsapp)',
  })
  pingProvider(
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.pingProvider(code, user);
  }

  @Get('webhooks/inbox')
  @RequirePermissions('integrations.manage')
  @ApiOperation({ summary: 'List webhook inbox (limit 50, org + system)' })
  @ApiQuery({ name: 'status', required: false })
  listInbox(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.service.listWebhookInbox(user, status);
  }

  @Post('webhooks/inbox/:id/replay')
  @RequirePermissions('integrations.manage')
  @ApiOperation({ summary: 'Requeue webhook inbox entry (status → RECEIVED)' })
  replayInbox(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.replayWebhook(id, user);
  }

  @Get('outbox')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'List pending/failed integration outbox (limit 50)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'PENDING | FAILED | PUBLISHED (default: PENDING+FAILED)',
  })
  listOutbox(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.service.listOutbox(user, status);
  }

  @Post('outbox/:id/replay')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Requeue PENDING/FAILED outbox (safe — does not touch PUBLISHED)',
  })
  replayOutbox(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.replayOutbox(id, user);
  }
}
