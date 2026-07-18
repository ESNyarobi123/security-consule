import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { AttendanceService } from '../application/attendance.service';
import {
  AttendanceListItemDto,
  AttendanceResponseDto,
  ClockInDto,
  ClockOutDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
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

  @Post(':id/approve')
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
  @ApiOperation({ summary: 'List guard attendance records' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'supervisorApproved',
    required: false,
    enum: ['true', 'false'],
  })
  @ApiOkResponse({ type: [AttendanceListItemDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('supervisorApproved') supervisorApproved?: string,
  ) {
    const approved =
      supervisorApproved === 'true'
        ? true
        : supervisorApproved === 'false'
          ? false
          : undefined;
    return this.service.list(user.organizationId, siteId, approved);
  }
}
