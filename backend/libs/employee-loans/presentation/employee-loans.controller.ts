import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { EmployeeLoansService } from '../application/employee-loans.service';
import {
  ApplyLoanDto,
  ApproveLoanResponseDto,
  EmployeeLoanResponseDto,
  LoanInstallmentResponseDto,
} from './dto/loan.dto';

@ApiTags('Employee Loans')
@ApiBearerAuth()
@Controller('loans')
export class EmployeeLoansController {
  constructor(private readonly service: EmployeeLoansService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for employee loan' })
  @ApiCreatedResponse({ type: EmployeeLoanResponseDto })
  apply(@Body() dto: ApplyLoanDto, @CurrentUser() user: AuthUser) {
    return this.service.apply(dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve loan and generate installment schedule' })
  @ApiOkResponse({ type: ApproveLoanResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
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

  @Get(':id/installments')
  @ApiOperation({ summary: 'List loan installments' })
  @ApiOkResponse({ type: [LoanInstallmentResponseDto] })
  installments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listInstallments(id, user.organizationId);
  }
}
