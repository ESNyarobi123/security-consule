import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { DeviceRegistryService } from '../application/device-registry.service';
import { DeviceCommandService } from '../application/device-command.service';
import {
  IssueCommandDto,
  RegisterDeviceDto,
  RegisterEdgeGatewayDto,
  UpdateDeviceDto,
} from './dto/device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(
    private readonly registry: DeviceRegistryService,
    private readonly commands: DeviceCommandService,
  ) {}

  // ── Edge gateways (declared before /:id to avoid route capture) ──
  @Post('gateways')
  @ApiOperation({ summary: 'Register a site edge gateway (returns API key once)' })
  @ApiCreatedResponse({ description: 'Gateway registered; apiKey returned once' })
  registerGateway(
    @Body() dto: RegisterEdgeGatewayDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.registerGateway(dto, user);
  }

  @Get('gateways')
  @ApiOperation({ summary: 'List edge gateways' })
  listGateways(@CurrentUser() user: AuthUser) {
    return this.registry.listGateways(user);
  }

  // ── Devices ──────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Register a device (apiKey returned once if directPush)' })
  @ApiCreatedResponse({ description: 'Device registered' })
  registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.registerDevice(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List devices' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ description: 'Device list' })
  listDevices(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
  ) {
    return this.registry.listDevices(user, { type, siteId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Device detail + counts' })
  getDevice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registry.getDevice(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update device (status/config/site/gate)' })
  updateDevice(
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.updateDevice(id, dto, user);
  }

  // ── Commands ─────────────────────────────────────────────────
  @Post(':id/commands')
  @ApiOperation({ summary: 'Issue a command to a device (enroll/print/open-gate/sync)' })
  @ApiCreatedResponse({ description: 'Command queued' })
  issueCommand(
    @Param('id') id: string,
    @Body() dto: IssueCommandDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commands.issue(id, dto, user);
  }

  @Get(':id/commands')
  @ApiOperation({ summary: 'List recent commands for a device' })
  listCommands(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commands.listForDevice(id, user);
  }
}
