import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import {
  EssApplyLeaveDto,
  EssLeaveBalanceDto,
  EssLoanBalanceDto,
  EssProfileResponseDto,
} from '@pssms/workforce';
import { PayrollService } from '../application/payroll.service';
import { MyPayslipResponseDto } from './dto/payroll.dto';

/**
 * Portal 35.16 — employee self-service inside the Payroll portal.
 *
 * Deliberately **not** gated by `payroll.manage` or `ess.access`: every
 * signed-in employee may read their own payslips, profile, leave balance and
 * loan position. The services resolve the caller's Employee row and filter by
 * that employee id, so no branch/company payroll data is reachable from here.
 *
 * These routes exist so the Payroll portal no longer depends on the separate
 * ESS permission — no administrator has to unlock an employee's own records.
 */
@ApiTags('Payroll — My payslips')
@ApiBearerAuth()
@Controller('payroll/me')
export class PayrollMeController {
  constructor(private readonly service: PayrollService) {}

  @Get('payslips')
  @ApiOperation({
    summary: 'My payslip snapshots only (self-scoped, no payroll.manage needed)',
  })
  @ApiOkResponse({ type: [MyPayslipResponseDto] })
  payslips(@CurrentUser() user: AuthUser) {
    return this.service.listMyPayslips(user);
  }

  @Get('payslips/:id')
  @ApiOperation({ summary: 'My payslip by id (self-scoped)' })
  @ApiOkResponse({ type: MyPayslipResponseDto })
  payslip(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getMyPayslip(id, user);
  }

  @Get('profile')
  @ApiOperation({ summary: 'My employee profile (self-scoped)' })
  @ApiOkResponse({ type: EssProfileResponseDto })
  profile(@CurrentUser() user: AuthUser) {
    return this.service.getMyProfile(user);
  }

  @Get('leave-types')
  @ApiOperation({ summary: 'Leave types available to me' })
  leaveTypes(@CurrentUser() user: AuthUser) {
    return this.service.listMyLeaveTypes(user);
  }

  @Get('leave-balances')
  @ApiOperation({ summary: 'My leave balances for the current year' })
  @ApiOkResponse({ type: [EssLeaveBalanceDto] })
  leaveBalances(@CurrentUser() user: AuthUser) {
    return this.service.listMyLeaveBalances(user);
  }

  @Get('leave-requests')
  @ApiOperation({ summary: 'My leave requests' })
  leaveRequests(@CurrentUser() user: AuthUser) {
    return this.service.listMyLeaveRequests(user);
  }

  @Post('leave')
  @ApiOperation({
    summary: 'Apply for leave (self-scoped; normal approval chain, creator ≠ approver)',
  })
  @ApiCreatedResponse({ description: 'Leave request submitted' })
  applyLeave(@Body() dto: EssApplyLeaveDto, @CurrentUser() user: AuthUser) {
    return this.service.applyMyLeave(dto, user);
  }

  @Get('loan-balance')
  @ApiOperation({ summary: 'My loan outstanding balance and counts' })
  @ApiOkResponse({ type: EssLoanBalanceDto })
  loanBalance(@CurrentUser() user: AuthUser) {
    return this.service.getMyLoanBalance(user);
  }
}
