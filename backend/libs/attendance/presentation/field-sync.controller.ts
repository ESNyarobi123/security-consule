import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { FieldSyncService } from '../application/field-sync.service';
import {
  FieldSyncBatchDto,
  FieldSyncResultDto,
} from './dto/attendance.dto';

@ApiTags('Field Sync')
@ApiBearerAuth()
@Controller('field/sync')
export class FieldSyncController {
  constructor(private readonly service: FieldSyncService) {}

  @Post()
  @ApiOperation({
    summary: 'Offline-first batch sync (guard mobile app)',
    description:
      'Accepts queued events with clientEventId (UUID) for idempotency. Stores deviceTime + serverReceivedTime. Event types: CLOCK_IN, ALERTNESS_CONFIRM, PATROL_SCAN.',
  })
  @ApiOkResponse({ type: [FieldSyncResultDto] })
  sync(@Body() dto: FieldSyncBatchDto, @CurrentUser() user: AuthUser) {
    return this.service.syncBatch(dto, user);
  }
}
