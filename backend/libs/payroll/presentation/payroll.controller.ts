import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { PayrollService } from '../application/payroll.service';
import {
  CreatePayrollCycleDto,
  MarkPayrollPaidDto,
  PayrollCycleResponseDto,
  PayslipSnapshotResponseDto,
} from './dto/payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

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
  listCycles(@CurrentUser() user: AuthUser) {
    return this.service.listCycles(user.organizationId);
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
}
