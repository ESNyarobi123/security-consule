import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { IncidentsService } from '../application/incidents.service';
import {
  CreateIncidentDto,
  IncidentCategoryOptionDto,
  IncidentOfficerOptionDto,
  IncidentResponseDto,
  UpdateIncidentStatusDto,
} from './dto/incident.dto';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('incidents.manage')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Post()
  @ApiOperation({ summary: 'Report security incident' })
  @ApiCreatedResponse({ type: IncidentResponseDto })
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get('category-options')
  @ApiOperation({ summary: 'Incident category catalog (design §31)' })
  @ApiOkResponse({ type: IncidentCategoryOptionDto, isArray: true })
  categoryOptions() {
    return this.service.categoryOptions();
  }

  @Get('officer-options')
  @ApiOperation({ summary: 'Active internal users assignable as responsible officer' })
  @ApiOkResponse({ type: IncidentOfficerOptionDto, isArray: true })
  officerOptions(@CurrentUser() user: AuthUser) {
    return this.service.officerOptions(user);
  }

  @Get()
  @ApiOperation({
    summary: 'List incidents (enriched with allowedNextStatuses for actor)',
  })
  @ApiOkResponse({ type: IncidentResponseDto, isArray: true })
  @ApiQuery({ name: 'siteId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, user, siteId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Update incident status (A4b: role matrix + reporter≠closer; Guard create-only)',
  })
  @ApiOkResponse({ type: IncidentResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}
