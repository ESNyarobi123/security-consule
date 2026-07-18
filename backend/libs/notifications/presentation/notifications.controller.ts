import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { NotificationsService } from '../application/notifications.service';
import {
  DeliveryAttemptDto,
  EnqueueNotificationDto,
  NotificationResponseDto,
} from './dto/notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Enqueue notification (dispatched by worker)' })
  @ApiCreatedResponse({ type: NotificationResponseDto })
  enqueue(@Body() dto: EnqueueNotificationDto, @CurrentUser() user: AuthUser) {
    return this.service.enqueue(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiOkResponse({ type: [NotificationResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: NotificationStatus,
  ) {
    return this.service.list(user.organizationId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification' })
  @ApiOkResponse({ type: NotificationResponseDto })
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getById(id, user.organizationId);
  }

  @Get(':id/attempts')
  @ApiOperation({ summary: 'List delivery attempts' })
  @ApiOkResponse({ type: [DeliveryAttemptDto] })
  attempts(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listAttempts(id, user.organizationId);
  }
}
