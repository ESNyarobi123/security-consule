import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
} from '@pssms/shared';
import { OperationsReportsService } from '../application/operations-reports.service';
import {
  OperationsReportQueryDto,
  OperationsReportResponseDto,
} from './dto/operations-report.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly reports: OperationsReportsService) {}

  @Get('reports')
  @RequireAnyPermissions(
    'operations.manage',
    'attendance.manage',
    'reporting.read',
  )
  @ApiOperation({
    summary:
      'Branch / Field Ops reports pack (Module 34-A · attendance, alertness, patrols, incidents, gate, CCTV metadata)',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: OperationsReportResponseDto })
  getOperationsReports(
    @CurrentUser() user: AuthUser,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.reports.build(
      user,
      query.from,
      query.to,
      query.siteId,
    );
  }
}
