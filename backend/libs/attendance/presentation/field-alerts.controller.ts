import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
  RequireAnyPermissions,
} from '@pssms/shared';
import { FieldAlertsService } from '../application/field-alerts.service';
import { FieldAlertResponseDto } from './dto/attendance.dto';
import { FIELD_ALERT_ESCALATION_STAGES } from '../domain/field-alert.constants';

@ApiTags('Field Alerts')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequireAnyPermissions('operations.manage', 'attendance.manage')
@Controller('attendance/field-alerts')
export class FieldAlertsController {
  constructor(private readonly service: FieldAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List field alerts (HIGH severity first)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'acknowledged',
    required: false,
    enum: ['true', 'false'],
  })
  @ApiQuery({
    name: 'escalationStage',
    required: false,
    enum: FIELD_ALERT_ESCALATION_STAGES,
  })
  @ApiOkResponse({ type: [FieldAlertResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('acknowledged') acknowledged?: string,
    @Query('escalationStage') escalationStage?: string,
  ) {
    const acked =
      acknowledged === 'true'
        ? true
        : acknowledged === 'false'
          ? false
          : undefined;
    const stage =
      escalationStage &&
      (FIELD_ALERT_ESCALATION_STAGES as readonly string[]).includes(
        escalationStage,
      )
        ? (escalationStage as (typeof FIELD_ALERT_ESCALATION_STAGES)[number])
        : undefined;
    return this.service.list(
      user.organizationId,
      siteId,
      acked,
      stage,
    );
  }

  @Post(':id/escalate')
  @ApiOperation({
    summary:
      'Advance field-alert escalation (ALERTNESS_MISSED / PATROL_MISSED: SUPERVISOR→FIELD→BOM→CONTROL)',
  })
  @ApiOkResponse({ type: FieldAlertResponseDto })
  escalate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.escalate(id, user);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a field alert (idempotent)' })
  @ApiOkResponse({ type: FieldAlertResponseDto })
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.acknowledge(id, user);
  }
}
