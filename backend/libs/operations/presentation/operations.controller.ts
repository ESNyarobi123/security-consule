import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  RequirePermissions,
} from '@pssms/shared';
import { BranchDeskService } from '../application/branch-desk.service';
import { OperationsReportsService } from '../application/operations-reports.service';
import {
  OperationsReportQueryDto,
  OperationsReportResponseDto,
} from './dto/operations-report.dto';
import { CreateBranchPettyCashDto } from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('operations')
export class OperationsController {
  constructor(
    private readonly reports: OperationsReportsService,
    private readonly desk: BranchDeskService,
  ) {}

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

  @Get('desk-summary')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'Portal 35.23 live desk counts (staff/parking/inspect/petty)' })
  deskSummary(@CurrentUser() user: AuthUser) {
    return this.desk.deskSummary(user);
  }

  @Get('staff')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'Deployed guard roster at scoped sites (read-only vs HR)' })
  staff(@CurrentUser() user: AuthUser) {
    return this.desk.staffRoster(user);
  }

  @Get('inspections')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'EOB supervisor comments / handover notes' })
  inspections(@CurrentUser() user: AuthUser) {
    return this.desk.inspections(user);
  }

  @Get('parking-monitor')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'Read-only parking board for field sites' })
  parking(@CurrentUser() user: AuthUser) {
    return this.desk.parkingMonitor(user);
  }

  @Get('petty-cash')
  @RequirePermissions('operations.manage')
  @ApiOperation({ summary: 'Branch-scoped petty cash requests (no issue)' })
  pettyCash(@CurrentUser() user: AuthUser) {
    return this.desk.listPettyCash(user);
  }

  @Post('petty-cash')
  @RequirePermissions('operations.manage')
  @ApiOperation({
    summary:
      'Request petty cash for a branch. Approve/issue stays Finance (creator ≠ issuer).',
  })
  requestPetty(
    @Body() dto: CreateBranchPettyCashDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.desk.requestPettyCash(dto, user);
  }
}
