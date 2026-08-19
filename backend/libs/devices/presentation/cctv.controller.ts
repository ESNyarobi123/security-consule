import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
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
