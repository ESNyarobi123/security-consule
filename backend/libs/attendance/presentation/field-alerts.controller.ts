import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { FieldAlertsService } from '../application/field-alerts.service';
import { FieldAlertResponseDto } from './dto/attendance.dto';

@ApiTags('Field Alerts')
@ApiBearerAuth()
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
  @ApiOkResponse({ type: [FieldAlertResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('acknowledged') acknowledged?: string,
  ) {
    const acked =
      acknowledged === 'true'
        ? true
        : acknowledged === 'false'
          ? false
          : undefined;
    return this.service.list(user.organizationId, siteId, acked);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a field alert (idempotent)' })
  @ApiOkResponse({ type: FieldAlertResponseDto })
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.acknowledge(id, user);
  }
}
