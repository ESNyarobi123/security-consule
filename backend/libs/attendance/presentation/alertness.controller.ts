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
import { AlertnessService } from '../application/alertness.service';
import {
  ConfirmAlertnessDto,
  ScheduleAlertnessDto,
} from './dto/attendance.dto';

@ApiTags('Alertness')
@ApiBearerAuth()
@Controller('attendance/alertness')
export class AlertnessController {
  constructor(private readonly service: AlertnessService) {}

  @Post('schedule')
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
  @ApiOperation({ summary: 'List pending alertness checks' })
  @ApiQuery({ name: 'guardId', required: false })
  pending(@CurrentUser() user: AuthUser, @Query('guardId') guardId?: string) {
    return this.service.listPending(user, guardId);
  }

  @Post(':id/missed')
  @ApiOperation({
    summary: 'Mark alertness as missed — creates field alert for supervisor',
  })
  missed(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.markMissed(id, user);
  }
}
