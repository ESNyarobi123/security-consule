import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { DeviceRegistryService } from '../application/device-registry.service';
import { DeviceCommandService } from '../application/device-command.service';
import {
  DeviceResponseDto,
  EdgeGatewayResponseDto,
  IssueCommandDto,
  RegisterDeviceDto,
  RegisterEdgeGatewayDto,
  UpdateDeviceDto,
} from './dto/device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
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
  @ApiOperation({ summary: 'List edge gateways (ops-enriched site labels)' })
  @ApiOkResponse({ type: [EdgeGatewayResponseDto] })
  listGateways(@CurrentUser() user: AuthUser) {
    return this.registry.listGateways(user);
  }

  // ── Events (before /:id) ─────────────────────────────────────
  @Get('events')
  @ApiOperation({
    summary: 'List recent device events (org-scoped, take 50)',
    description:
      'AI/control-room alert inbox. Filter by type (e.g. CCTV_EVENT) and deviceId. Metadata only — no video.',
  })
  @ApiQuery({ name: 'type', required: false, example: 'CCTV_EVENT' })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiOkResponse({ description: 'Device event list' })
  listEvents(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.registry.listEvents(user, { type, deviceId });
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
  @ApiOperation({ summary: 'List devices (ops-enriched site labels)' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ type: [DeviceResponseDto], description: 'Device list' })
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
