import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  RequirePermissions,
} from '@pssms/shared';
import { CheckpointsService } from '../application/checkpoints.service';
import {
  CheckpointResponseDto,
  CreateCheckpointDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('operations/checkpoints')
export class CheckpointsController {
  constructor(private readonly service: CheckpointsService) {}

  @Post()
  @ApiOperation({ summary: 'Create patrol checkpoint (QR/NFC/GPS)' })
  @ApiCreatedResponse({ type: CheckpointResponseDto })
  create(@Body() dto: CreateCheckpointDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List patrol checkpoints',
    description:
      'Requires operations.manage. Optional siteId filter; omit for org-wide active checkpoints.',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [CheckpointResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, user, siteId);
  }
}
