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
import { OccurrenceService } from '../application/occurrence.service';
import {
  CorrectOccurrenceDto,
  CreateOccurrenceDto,
  OccurrenceResponseDto,
} from './dto/occurrence.dto';

@ApiTags('Occurrence Book')
@ApiBearerAuth()
@Controller('occurrence-book')
export class OccurrenceController {
  constructor(private readonly service: OccurrenceService) {}

  @Post()
  @ApiOperation({
    summary: 'Create occurrence book entry (append-only)',
    description: 'Original entries are never edited — use correct endpoint.',
  })
  @ApiCreatedResponse({ type: OccurrenceResponseDto })
  create(@Body() dto: CreateOccurrenceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Post(':id/correct')
  @ApiOperation({
    summary: 'Create corrected version (reason + approver required)',
  })
  @ApiCreatedResponse({ type: OccurrenceResponseDto })
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectOccurrenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.correct(id, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List current occurrence entries' })
  @ApiQuery({ name: 'siteId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }
}
