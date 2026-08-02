import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
} from '@pssms/shared';
import { AttendanceService } from '../application/attendance.service';
import {
  AttendanceListItemDto,
  AttendanceResponseDto,
  ClockInDto,
  ClockOutDto,
  SupervisorClockInDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('clock-in')
  @ApiOperation({
    summary: 'Guard clock-in with GPS verification',
    description:
      'Records server_received_time and device_time. Geofence validated against site coordinates. Supports offline sync via clientEventId.',
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  clockIn(@Body() dto: ClockInDto, @CurrentUser() user: AuthUser) {
    return this.service.clockIn(dto, user);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Guard clock-out' })
  @ApiOkResponse({ type: AttendanceResponseDto })
  clockOut(@Body() dto: ClockOutDto, @CurrentUser() user: AuthUser) {
    return this.service.clockOut(dto, user);
  }

  @Post('supervisor-clock-in')
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary: 'Supervisor manual clock-in for a guard',
    description:
      'Records SUPERVISOR method when mobile punch fails. Rejects open attendance duplicate (409). Auto-schedules alertness like guard clock-in.',
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  supervisorClockIn(
    @Body() dto: SupervisorClockInDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.supervisorClockIn(dto, user);
  }

  @Post(':id/approve')
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary: 'Supervisor approve guard attendance',
    description:
      'Idempotent if already approved. Returns 403 CREATOR_CANNOT_APPROVE when the actor is the guard on the record.',
  })
  @ApiOkResponse({ type: AttendanceListItemDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Get()
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary: 'List guard attendance records (org-scoped)',
    description:
      'Requires operations.manage or attendance.manage. Optional from/to filter on clockInAt (ISO).',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'supervisorApproved',
    required: false,
    enum: ['true', 'false'],
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO datetime — clockInAt >= from',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO datetime — clockInAt < to',
  })
  @ApiOkResponse({ type: [AttendanceListItemDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('supervisorApproved') supervisorApproved?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const approved =
      supervisorApproved === 'true'
        ? true
        : supervisorApproved === 'false'
          ? false
          : undefined;
    return this.service.list(
      user.organizationId,
      siteId,
      approved,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
