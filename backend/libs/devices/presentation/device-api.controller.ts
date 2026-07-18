import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '@pssms/shared';
import {
  DeviceAuthContext,
  DeviceAuthGuard,
  DeviceContext,
} from '../infrastructure/device-auth.guard';
import { DeviceIngestionService } from '../application/device-ingestion.service';
import { DeviceCommandService } from '../application/device-command.service';
import {
  AckCommandDto,
  HeartbeatDto,
  IngestEventsDto,
} from './dto/device.dto';

/**
 * Device-facing edge API. Authenticated by `X-Device-Key` (network terminals)
 * or `X-Gateway-Key` (site edge gateways). Marked @Public so the JWT guard is
 * skipped; DeviceAuthGuard establishes the org context instead.
 */
@ApiTags('Device Edge API')
@ApiSecurity('device-key')
@Public()
@UseGuards(DeviceAuthGuard)
@Controller('device-api')
export class DeviceApiController {
  constructor(
    private readonly ingestion: DeviceIngestionService,
    private readonly commands: DeviceCommandService,
  ) {}

  @Post('heartbeat')
  @ApiOperation({ summary: 'Device/gateway liveness ping (returns pending command count)' })
  heartbeat(@DeviceContext() ctx: DeviceAuthContext, @Body() dto: HeartbeatDto) {
    return this.ingestion.heartbeat(ctx, dto);
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest a batch of device events (idempotent via dedupeKey)' })
  ingest(@DeviceContext() ctx: DeviceAuthContext, @Body() dto: IngestEventsDto) {
    return this.ingestion.ingest(ctx, dto.events);
  }

  @Get('commands')
  @ApiOperation({ summary: 'Poll pending commands (marks them DISPATCHED)' })
  poll(@DeviceContext() ctx: DeviceAuthContext) {
    return this.commands.poll(ctx);
  }

  @Post('commands/:id/ack')
  @ApiOperation({ summary: 'Acknowledge command result (ACKED/FAILED)' })
  ack(
    @DeviceContext() ctx: DeviceAuthContext,
    @Param('id') id: string,
    @Body() dto: AckCommandDto,
  ) {
    return this.commands.ack(ctx, id, dto);
  }
}
