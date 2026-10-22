import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { CctvMonitoringService } from '../application/cctv-monitoring.service';

@ApiTags('CCTV / Security Monitoring')
@ApiBearerAuth()
@Controller('cctv')
@UseGuards(PermissionsGuard)
@RequirePermissions('cctv.manage')
export class CctvController {
  constructor(private readonly monitor: CctvMonitoringService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Control-room overview: cameras, AI alerts, parking, access, patrols, alarms, incidents',
    description:
      'Single call for the monitoring wall. Supervisors are site-scoped (assigned sites). Metadata only — video stays on the NVR.',
  })
  @ApiOkResponse({ description: 'Monitoring overview' })
  @ApiQuery({ name: 'siteId', required: false })
  overview(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.monitor.overview(user, { siteId });
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Rich AI alert inbox (normalised detection, camera, site, confidence)',
    description:
      'Each CCTV_EVENT is enriched with camera + site labels, AI detection class, severity, confidence, zone, snapshot URL, recommended action and the incident recorded from it (28-A).',
  })
  @ApiQuery({ name: 'status', required: false, example: 'OPEN' })
  @ApiQuery({ name: 'severity', required: false, example: 'HIGH' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'take', required: false, example: 60 })
  @ApiOkResponse({ description: 'Normalised CCTV AI alert inbox' })
  alerts(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.monitor.alerts(user, {
      status,
      severity,
      siteId,
      deviceId,
      from,
      to,
      q,
      take,
    });
  }

  @Get('reports')
  @ApiOkResponse({ description: 'Live control-room KPI pack (Portal 35.22)' })
  @ApiOperation({ summary: 'CCTV monitoring reports (metadata only — no video)' })
  reports(@CurrentUser() user: AuthUser) {
    return this.monitor.reports(user);
  }

  @Get('parking-monitor')
  @ApiOperation({ summary: 'Read-only parking entries / violations / occupancy' })
  parking(@CurrentUser() user: AuthUser) {
    return this.monitor.parkingMonitor(user);
  }

  @Get('access-monitor')
  @ApiOperation({
    summary: 'Read-only customer-employee access + visitor gate denies',
  })
  access(@CurrentUser() user: AuthUser) {
    return this.monitor.accessMonitor(user);
  }

  @Get('patrol-monitor')
  @ApiOperation({ summary: 'Read-only patrol scans + PATROL_MISSED alerts' })
  patrols(@CurrentUser() user: AuthUser) {
    return this.monitor.patrolMonitor(user);
  }

  @Get('alarm-monitor')
  @ApiOperation({ summary: 'FieldAlert + failed camera events as the alarm surface' })
  alarms(@CurrentUser() user: AuthUser) {
    return this.monitor.alarmMonitor(user);
  }

  @Get('incident-monitor')
  @ApiOperation({ summary: 'Read-only open security incidents' })
  incidents(@CurrentUser() user: AuthUser) {
    return this.monitor.incidentMonitor(user);
  }
}
