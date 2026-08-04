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
import { PatrolRoutesService } from '../application/patrol-routes.service';
import {
  CreatePatrolRouteDto,
  PatrolRouteResponseDto,
  PatrolScanMissedResultDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('operations/patrol-routes')
export class PatrolRoutesController {
  constructor(private readonly service: PatrolRoutesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create ordered patrol route (checkpoint sequence for a site)',
  })
  @ApiCreatedResponse({ type: PatrolRouteResponseDto })
  create(@Body() dto: CreatePatrolRouteDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List active patrol routes with today’s coverage + SLA status',
    description:
      'coverageStatus: NOT_STARTED | IN_PROGRESS | COMPLETED. slaStatus: OK | ON_TRACK | LATE | MISSED (A4a).',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [PatrolRouteResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, user, siteId);
  }

  @Post('scan-missed')
  @ApiOperation({
    summary:
      'Mark past-due incomplete routes MISSED + FieldAlert PATROL_MISSED (A4a)',
  })
  @ApiQuery({
    name: 'graceMinutes',
    required: false,
    description: 'Extra minutes after due before marking missed',
  })
  @ApiOkResponse({ type: PatrolScanMissedResultDto })
  scanMissed(
    @CurrentUser() user: AuthUser,
    @Query('graceMinutes') graceQuery?: string,
  ) {
    const grace = graceQuery ? Number(graceQuery) : 0;
    return this.service.scanMissed(
      user.organizationId,
      user,
      Number.isFinite(grace) && grace >= 0 ? grace : 0,
    );
  }

  @Post(':id/mark-missed')
  @ApiOperation({
    summary: 'Mark one past-due incomplete route missed + FieldAlert',
  })
  @ApiOkResponse({ type: PatrolRouteResponseDto })
  markMissed(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.markMissed(id, user);
  }
}
