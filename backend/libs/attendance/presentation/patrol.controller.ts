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
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { PatrolService } from '../application/patrol.service';
import { PatrolIssueDto, PatrolScanDto } from './dto/attendance.dto';

@ApiTags('Patrols')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance/patrols')
export class PatrolController {
  constructor(private readonly service: PatrolService) {}

  @Get('routes')
  @RequirePermissions('attendance.manage')
  @ApiOperation({
    summary: 'List active patrol routes for the Guard Mobile App',
    description:
      'Site-scoped route/checkpoint catalog. Does not disclose QR or NFC token values.',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ description: 'Guard-safe active route catalog' })
  listRoutes(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.listGuardRoutes(user, siteId);
  }

  @Post('scan')
  @RequirePermissions('attendance.manage')
  @ApiOperation({
    summary: 'Record checkpoint scan (QR/NFC/GPS)',
    description:
      'Field/guard path. Dual verification: checkpoint code + GPS at scan time. Requires attendance.manage.',
  })
  @ApiCreatedResponse({ description: 'PatrolScan recorded' })
  scan(@Body() dto: PatrolScanDto, @CurrentUser() user: AuthUser) {
    return this.service.scan(dto, user);
  }

  @Post('issues')
  @RequirePermissions('attendance.manage')
  @ApiOperation({
    summary: 'Report a patrol issue as a security incident',
    description:
      'Guard Mobile/offline path. Validates route/checkpoint/site, records GPS and creates PATROL_ISSUE via IncidentsService.',
  })
  @ApiCreatedResponse({ description: 'PATROL_ISSUE incident recorded' })
  reportIssue(@Body() dto: PatrolIssueDto, @CurrentUser() user: AuthUser) {
    return this.service.reportIssue(dto, user);
  }

  @Get()
  @RequireAnyPermissions('operations.manage', 'attendance.manage')
  @ApiOperation({
    summary: 'List patrol scans',
    description:
      'Requires operations.manage or attendance.manage. Includes checkpoint + site labels.',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ description: 'Recent patrol scans (max 100)' })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, user, siteId);
  }
}
