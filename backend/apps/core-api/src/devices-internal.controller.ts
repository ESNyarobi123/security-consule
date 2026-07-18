import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, ServiceTokenGuard } from '@pssms/shared';
import {
  DeviceAuthContext,
  DeviceCommandService,
  DeviceIngestionService,
  DeviceRegistryService,
  IngestEventDto,
} from '@pssms/devices';

/**
 * Trusted service-token surface used by the integration-gateway's ZKTeco
 * iClock adapter (and other protocol bridges). Devices are resolved by serial
 * number; the gateway never needs per-device API keys.
 */
@ApiTags('Internal')
@Controller('internal/v1/devices')
@Public()
@UseGuards(ServiceTokenGuard)
export class DevicesInternalController {
  constructor(
    private readonly registry: DeviceRegistryService,
    private readonly ingestion: DeviceIngestionService,
    private readonly commands: DeviceCommandService,
  ) {}

  private async ctx(serialNumber: string): Promise<DeviceAuthContext> {
    const device = await this.registry.findBySerial(serialNumber);
    return {
      kind: 'device',
      organizationId: device.organizationId,
      device,
    };
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest normalized device events by serial number' })
  async ingest(
    @Body() body: { serialNumber: string; events: IngestEventDto[] },
  ) {
    return this.ingestion.ingest(await this.ctx(body.serialNumber), body.events);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Device liveness ping by serial number' })
  async heartbeat(
    @Body() body: { serialNumber: string; version?: string; ipAddress?: string },
  ) {
    return this.ingestion.heartbeat(await this.ctx(body.serialNumber), {
      version: body.version,
      ipAddress: body.ipAddress,
    });
  }

  @Get('commands')
  @ApiOperation({ summary: 'Poll pending commands by serial number' })
  async poll(@Query('serialNumber') serialNumber: string) {
    return this.commands.poll(await this.ctx(serialNumber));
  }

  @Post('commands/:id/ack')
  @ApiOperation({ summary: 'Acknowledge command result by serial number' })
  async ack(
    @Param('id') id: string,
    @Body()
    body: {
      serialNumber: string;
      status: 'ACKED' | 'FAILED';
      result?: Record<string, unknown>;
    },
  ) {
    return this.commands.ack(await this.ctx(body.serialNumber), id, {
      status: body.status,
      result: body.result,
    });
  }
}
