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
  RequirePermissions,
} from '@pssms/shared';
import { OccurrenceService } from '../application/occurrence.service';
import {
  CorrectOccurrenceDto,
  CreateOccurrenceDto,
  OccurrenceHistoryVersionDto,
  OccurrenceResponseDto,
} from './dto/occurrence.dto';

@ApiTags('Occurrence Book')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
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
    summary: 'Create corrected version (reason required; append-only)',
  })
  @ApiCreatedResponse({ type: OccurrenceResponseDto })
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectOccurrenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.correct(id, dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Second-person approve current entry (recorder ≠ approver)',
    description:
      'Sets approvedBy on the current version. Originals and corrections are both approvable. Creator/corrector cannot self-approve.',
  })
  @ApiCreatedResponse({ type: OccurrenceResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Get()
  @ApiOperation({ summary: 'List current occurrence entries (org-scoped)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [OccurrenceResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Version lineage for an occurrence entry',
    description:
      'Accepts any id in the chain (current or superseded). Returns root→current ordered by version asc.',
  })
  @ApiOkResponse({ type: [OccurrenceHistoryVersionDto] })
  history(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.history(id, user.organizationId);
  }
}
