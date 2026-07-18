import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { IncidentsService } from '../application/incidents.service';
import {
  CreateIncidentDto,
  IncidentResponseDto,
  UpdateIncidentStatusDto,
} from './dto/incident.dto';

@ApiTags('Incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Post()
  @ApiOperation({ summary: 'Report security incident' })
  @ApiCreatedResponse({ type: IncidentResponseDto })
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  @ApiQuery({ name: 'siteId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update incident status / assignment' })
  @ApiOkResponse({ type: IncidentResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, dto.status, dto.assignedTo, user);
  }
}
