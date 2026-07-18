import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstallmentStatus, LoanStatus } from '@prisma/client';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class ApplyLoanDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(1)
  principalAmount!: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  termMonths!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  purpose!: string;
}

export class EmployeeLoanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() loanNumber!: string;
  @ApiProperty() principalAmount!: number;
  @ApiProperty() interestRate!: number;
  @ApiProperty() termMonths!: number;
  @ApiProperty() monthlyInstallment!: number;
  @ApiProperty({ enum: LoanStatus }) status!: LoanStatus;
  @ApiProperty() purpose!: string;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() disbursedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class LoanInstallmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() loanId!: string;
  @ApiProperty() installmentNumber!: number;
  @ApiProperty() dueDate!: Date;
  @ApiProperty() amountDue!: number;
  @ApiProperty() amountPaid!: number;
  @ApiProperty({ enum: InstallmentStatus }) status!: InstallmentStatus;
  @ApiPropertyOptional() payslipSnapshotId?: string | null;
  @ApiPropertyOptional() paidAt?: Date | null;
}

export class ApproveLoanResponseDto {
  @ApiProperty({ type: EmployeeLoanResponseDto }) loan!: EmployeeLoanResponseDto;
  @ApiProperty({ type: [LoanInstallmentResponseDto] }) installments!: LoanInstallmentResponseDto[];
}
