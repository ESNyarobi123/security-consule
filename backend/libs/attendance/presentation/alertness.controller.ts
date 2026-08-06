import {
  Body,
  Controller,
  Get,
  Param,
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
} from '@pssms/shared';
import { AlertnessService } from '../application/alertness.service';
import {
  ConfirmAlertnessDto,
  MarkAlertnessMissedDto,
  ScheduleAlertnessDto,
} from './dto/attendance.dto';

@ApiTags('Alertness')
@ApiBearerAuth()
@Controller('attendance/alertness')
export class AlertnessController {
  constructor(private readonly service: AlertnessService) {}

  @Post('schedule')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({ summary: 'Schedule alertness check for guard (supervisor/system)' })
  @ApiCreatedResponse({ description: 'AlertnessCheck created' })
  schedule(@Body() dto: ScheduleAlertnessDto, @CurrentUser() user: AuthUser) {
    return this.service.schedule(dto, user);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Guard confirms alertness (GPS/face/QR/NFC)' })
  confirm(@Body() dto: ConfirmAlertnessDto, @CurrentUser() user: AuthUser) {
    return this.service.confirm(dto, user);
  }

  @Get('pending')
  @ApiOperation({
    summary:
      'List pending alertness checks (org-wide for ops/attendance managers; self for guards)',
  })
  @ApiQuery({ name: 'guardId', required: false })
  @ApiOkResponse({ description: 'Pending AlertnessCheck[]' })
  pending(@CurrentUser() user: AuthUser, @Query('guardId') guardId?: string) {
    return this.service.listPending(user, guardId);
  }

  @Get('history')
  @ApiOperation({
    summary:
      'Module 10-C — completed alertness history (CONFIRMED/LATE/MISSED/CANCELLED) for audit',
  })
  @ApiQuery({ name: 'guardId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Comma-separated AlertnessStatus (default: completed set)',
  })
  @ApiQuery({ name: 'from', required: false, description: 'ISO scheduledAt ≥' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO scheduledAt <' })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiOkResponse({ description: 'Enriched AlertnessCheck history[]' })
  history(
    @CurrentUser() user: AuthUser,
    @Query('guardId') guardId?: string,
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
  ) {
    const n = take ? Number(take) : undefined;
    return this.service.listHistory(user, {
      guardId,
      siteId,
      status,
      from,
      to,
      take: n !== undefined && Number.isFinite(n) ? n : undefined,
    });
  }

  @Post('scan-missed')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary:
      'Mark past-due SCHEDULED alertness as MISSED + FieldAlert (ALERTNESS_MISSED)',
    description:
      'Default grace 0 minutes (due when scheduledAt passes). Worker: ALERTNESS_MISS_SCAN_ENABLED.',
  })
  @ApiQuery({ name: 'graceMinutes', required: false, type: Number })
  scanMissed(
    @CurrentUser() user: AuthUser,
    @Query('graceMinutes') graceMinutes?: string,
  ) {
    const grace = graceMinutes ? Number(graceMinutes) : 0;
    return this.service.scanMissed(
      user.organizationId,
      user,
      Number.isFinite(grace) && grace >= 0 ? grace : 0,
    );
  }

  @Post(':id/missed')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary:
      'Mark alertness as missed — creates field alert; optional supervisor remarks (§10-B)',
  })
  missed(
    @Param('id') id: string,
    @Body() dto: MarkAlertnessMissedDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.markMissed(id, user, dto.supervisorRemarks);
  }
}
