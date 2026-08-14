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
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { DeviceRegistryService } from '../application/device-registry.service';
import { DeviceCommandService } from '../application/device-command.service';
import { CctvTriageService } from '../application/cctv-triage.service';
import {
  AcknowledgeCctvEventDto,
  CreateIncidentFromEventDto,
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
@Controller('devices')
export class DeviceController {
  constructor(
    private readonly registry: DeviceRegistryService,
    private readonly commands: DeviceCommandService,
    private readonly cctvTriage: CctvTriageService,
  ) {}

  // ── Edge gateways (ops only — declared before /:id) ──
  @Post('gateways')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'Register a site edge gateway (returns API key once)' })
  @ApiCreatedResponse({ description: 'Gateway registered; apiKey returned once' })
  registerGateway(
    @Body() dto: RegisterEdgeGatewayDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.registerGateway(dto, user);
  }

  @Get('gateways')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'List edge gateways (ops-enriched site labels)' })
  @ApiOkResponse({ type: [EdgeGatewayResponseDto] })
  listGateways(@CurrentUser() user: AuthUser) {
    return this.registry.listGateways(user);
  }

  // ── Events (before /:id) ─────────────────────────────────────
  @Get('events')
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'List recent device events (org-scoped, take 50)',
    description:
      'AI/control-room alert inbox. Filter by type (e.g. CCTV_EVENT) and deviceId. Metadata only — no video. CCTV-scoped operators are forced to CCTV_EVENT.',
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

  // ── CCTV alert triage (Module 28-A) ──────────────────────────
  @Post('events/:id/acknowledge')
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'Acknowledge an open CCTV AI alert',
    description:
      'Marks a RECEIVED CCTV_EVENT as PROCESSED (routedTo=acknowledged) with audit. Metadata only.',
  })
  @ApiOkResponse({ description: 'Acknowledged event' })
  acknowledgeCctvEvent(
    @Param('id') id: string,
    @Body() dto: AcknowledgeCctvEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cctvTriage.acknowledgeEvent(id, dto ?? {}, user);
  }

  @Post('events/:id/create-incident')
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'Record a security incident from a CCTV AI alert',
    description:
      'Creates an incident (category CCTV_ALERT) at the camera site via IncidentsService — site ABAC + clientEventId dedupe apply. Event becomes PROCESSED (routedTo=incidents).',
  })
  @ApiCreatedResponse({ description: 'Incident + processed event' })
  createIncidentFromCctvEvent(
    @Param('id') id: string,
    @Body() dto: CreateIncidentFromEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cctvTriage.createIncidentFromEvent(id, dto ?? {}, user);
  }

  // ── Devices ──────────────────────────────────────────────────
  @Post()
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'Register a device (apiKey returned once if directPush)',
    description:
      'CCTV-scoped operators may only register type CCTV_CAMERA.',
  })
  @ApiCreatedResponse({ description: 'Device registered' })
  registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.registerDevice(dto, user);
  }

  @Get()
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'List devices (ops-enriched site labels)',
    description:
      'CCTV-scoped operators only see CCTV_CAMERA rows.',
  })
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
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({ summary: 'Device detail + counts' })
  getDevice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registry.getDevice(id, user);
  }

  @Patch(':id')
  @RequireAnyPermissions('operations.manage', 'cctv.manage')
  @ApiOperation({ summary: 'Update device (status/config/site/gate)' })
  updateDevice(
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registry.updateDevice(id, dto, user);
  }

  // ── Commands (full ops only) ─────────────────────────────────
  @Post(':id/commands')
  @RequirePermissions('operations.manage')
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
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'List recent commands for a device' })
  listCommands(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commands.listForDevice(id, user);
  }
}
