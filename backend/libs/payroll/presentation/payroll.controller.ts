import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { PayrollDueAlertStatus, PayrollTenantType } from '@prisma/client';
import { PayrollDueService } from '../application/payroll-due.service';
import { PayrollService } from '../application/payroll.service';
import {
  GrantPayrollPayExceptionDto,
  PayrollDueAlertResponseDto,
  PayrollDueScanResultDto,
  PayrollInvoiceGateDto,
} from './dto/payroll-due.dto';
import {
  CreatePayrollCycleDto,
  MarkPayrollPaidDto,
  PayrollCycleResponseDto,
  PayslipSnapshotResponseDto,
} from './dto/payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('payroll.manage')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly payrollDue: PayrollDueService,
  ) {}

  @Post('cycles')
  @ApiOperation({ summary: 'Create payroll cycle for period' })
  @ApiCreatedResponse({ type: PayrollCycleResponseDto })
  createCycle(
    @Body() dto: CreatePayrollCycleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createCycle(dto, user);
  }

  @Get('cycles')
  @ApiOperation({ summary: 'List payroll cycles' })
  @ApiOkResponse({ type: [PayrollCycleResponseDto] })
  listCycles(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('tenantType') tenantType?: PayrollTenantType,
  ) {
    return this.service.listCycles(user.organizationId, {
      customerId,
      tenantType,
    });
  }

  @Post('cycles/:id/generate')
  @ApiOperation({
    summary: 'Generate immutable payslip snapshots (freezes attendance inputs)',
  })
  @ApiOkResponse({ type: [PayslipSnapshotResponseDto] })
  generate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.generatePayslips(id, user);
  }

  @Post('cycles/:id/submit')
  @ApiOperation({ summary: 'Submit payroll for approval' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitForApproval(id, user);
  }

  @Post('cycles/:id/approve')
  @ApiOperation({ summary: 'Approve payroll cycle (GM)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveCycle(id, user);
  }

  @Get('due-alerts')
  @ApiOperation({
    summary: 'List e-payroll due alerts (Module 20-A)',
    description:
      'Alerts fire on the 1st of the month after the payroll period only when the related invoice is fully paid.',
  })
  @ApiOkResponse({ type: [PayrollDueAlertResponseDto] })
  listDueAlerts(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('status') status?: PayrollDueAlertStatus,
  ) {
    return this.payrollDue.listAlerts(user.organizationId, {
      customerId,
      status,
    });
  }

  @Post('due-alerts/scan')
  @ApiOperation({
    summary: 'Scan e-payroll due alerts (Module 20-A)',
    description:
      'Also callable by background-worker. force=1 ignores the 1st-of-month wait for smoke tests.',
  })
  @ApiOkResponse({ type: PayrollDueScanResultDto })
  scanDueAlerts(
    @CurrentUser() user: AuthUser,
    @Query('force') force?: string,
  ) {
    return this.payrollDue.scanDueAlerts(user.organizationId, user, {
      force: force === '1' || force === 'true',
    });
  }

  @Get('cycles/:id/invoice-gate')
  @ApiOperation({
    summary: 'Invoice payment gate for a customer payroll cycle (Module 20-A)',
  })
  @ApiOkResponse({ type: PayrollInvoiceGateDto })
  invoiceGate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payrollDue.getGateForCycle(id, user);
  }

  @Post('cycles/:id/pay-exception')
  @ApiOperation({
    summary:
      'GM/CEO/CMD exception to pay customer payroll despite unpaid invoice (Module 20-A)',
  })
  @ApiOkResponse({ type: PayrollInvoiceGateDto })
  grantPayException(
    @Param('id') id: string,
    @Body() dto: GrantPayrollPayExceptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payrollDue.grantPayException(id, dto, user);
  }

  @Post('cycles/:id/pay')
  @ApiOperation({ summary: 'Mark payroll as paid' })
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPayrollPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.markPaid(id, dto, user);
  }

  @Get('cycles/:id/payslips')
  @ApiOperation({ summary: 'List payslip snapshots for cycle (immutable reads)' })
  @ApiOkResponse({ type: [PayslipSnapshotResponseDto] })
  listPayslips(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listPayslips(id, user.organizationId);
  }

  @Get('payslips/:id')
  @ApiOperation({ summary: 'Get single payslip snapshot' })
  @ApiOkResponse({ type: PayslipSnapshotResponseDto })
  getPayslip(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getPayslip(id, user.organizationId);
  }

  @Get('cycles/:id/register')
  @ApiOperation({ summary: 'Payroll register — immutable snapshot summary' })
  getRegister(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getRegister(id, user.organizationId);
  }

  @Get('cycles/:id/reports/loan-deductions')
  @ApiOperation({ summary: 'Loan deduction report for cycle' })
  getLoanReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getLoanDeductionReport(id, user.organizationId);
  }

  @Get('cycles/:id/reports/statutory')
  @ApiOperation({ summary: 'Statutory deductions report (NSSF/PAYE)' })
  getStatutoryReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getStatutoryReport(id, user.organizationId);
  }

  @Get('cycles/:id/reports/approval')
  @ApiOperation({ summary: 'Payroll approval trail report' })
  getApprovalReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getApprovalReport(id, user.organizationId);
  }

  @Get('cycles/:id/export/bank-file')
  @ApiOperation({ summary: 'Bank payment file (CSV) — approved/paid cycles only' })
  exportBank(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.exportBankFile(id, user.organizationId, user.id);
  }

  @Get('cycles/:id/export/mobile-money-file')
  @ApiOperation({ summary: 'Mobile money payment file (CSV) — approved/paid cycles only' })
  exportMobile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.exportMobileMoneyFile(id, user.organizationId, user.id);
  }
}
