import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { CheckpointsService } from '../application/checkpoints.service';
import {
  CheckpointResponseDto,
  CreateCheckpointDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'List checkpoints for a site' })
  @ApiQuery({ name: 'siteId', required: true })
  @ApiOkResponse({ type: [CheckpointResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId: string) {
    return this.service.list(siteId, user.organizationId);
  }
}
