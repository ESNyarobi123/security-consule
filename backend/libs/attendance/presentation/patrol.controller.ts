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
import { PatrolScanDto } from './dto/attendance.dto';

@ApiTags('Patrols')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance/patrols')
export class PatrolController {
  constructor(private readonly service: PatrolService) {}

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
