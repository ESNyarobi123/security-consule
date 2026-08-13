import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { EmployeeLoansService } from '../application/employee-loans.service';
import {
  ApplyLoanDto,
  ApproveLoanResponseDto,
  EmployeeLoanResponseDto,
  IssueLoanDto,
  IssueLoanResponseDto,
  LoanInstallmentResponseDto,
  LoanStatementResponseDto,
  LoanTypeOptionDto,
  RejectLoanDto,
} from './dto/loan.dto';

@ApiTags('Employee Loans')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('loans.manage')
@Controller('loans')
export class EmployeeLoansController {
  constructor(private readonly service: EmployeeLoansService) {}

  @Get('type-options')
  @ApiOperation({ summary: 'Loan type catalog (Module 17)' })
  @ApiOkResponse({ type: [LoanTypeOptionDto] })
  typeOptions() {
    return this.service.listTypeOptions();
  }

  @Post()
  @ApiOperation({ summary: 'Apply for employee loan (HR / loans admin)' })
  @ApiCreatedResponse({ type: EmployeeLoanResponseDto })
  apply(@Body() dto: ApplyLoanDto, @CurrentUser() user: AuthUser) {
    return this.service.apply(dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve loan (schedule generated on issue)' })
  @ApiOkResponse({ type: ApproveLoanResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/issue')
  @ApiOperation({
    summary: 'Issue approved loan — cash or item; generates repayment schedule',
  })
  @ApiOkResponse({ type: IssueLoanResponseDto })
  issue(
    @Param('id') id: string,
    @Body() dto: IssueLoanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.issue(id, dto, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject loan request (creator ≠ approver)' })
  @ApiOkResponse({ type: EmployeeLoanResponseDto })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLoanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @Get('employee-options')
  @ApiOperation({
    summary: 'List employees for loan create/filter (loans.manage)',
  })
  listEmployeeOptions(@CurrentUser() user: AuthUser) {
    return this.service.listEmployeeOptions(user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List employee loans' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [EmployeeLoanResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.listLoans(user.organizationId, employeeId);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Loan statement — balance, schedule, settlement status' })
  @ApiOkResponse({ type: LoanStatementResponseDto })
  statement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getStatement(id, user.organizationId);
  }

  @Get(':id/installments')
  @ApiOperation({ summary: 'List loan installments' })
  @ApiOkResponse({ type: [LoanInstallmentResponseDto] })
  installments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listInstallments(id, user.organizationId);
  }
}
