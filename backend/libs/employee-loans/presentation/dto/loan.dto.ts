import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InstallmentStatus,
  LoanStatus,
  LoanType,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Item loans require itemName at application. */
export const ITEM_LOAN_TYPES: LoanType[] = [
  LoanType.SECURITY_BOOTS,
  LoanType.SMARTPHONE,
  LoanType.UNIFORM,
  LoanType.EQUIPMENT,
];

export class ApplyLoanDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: LoanType })
  @IsEnum(LoanType)
  loanType!: LoanType;

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

  @ApiPropertyOptional({ example: 'Emergency school fees' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  purpose?: string;

  @ApiPropertyOptional({ example: 'Security boots size 42' })
  @ValidateIf((o: ApplyLoanDto) => ITEM_LOAN_TYPES.includes(o.loanType))
  @IsString()
  @MinLength(2)
  itemName?: string;
}

export class IssueLoanDto {
  @ApiPropertyOptional({ example: '2026-08-13' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemCost?: number;

  @ApiPropertyOptional({
    description: 'When true, records employee acknowledgement at issue time',
  })
  @IsOptional()
  @IsBoolean()
  employeeAcknowledged?: boolean;
}

export class RejectLoanDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class EmployeeLoanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() loanNumber!: string;
  @ApiProperty({ enum: LoanType }) loanType!: LoanType;
  @ApiProperty() principalAmount!: number;
  @ApiProperty() interestRate!: number;
  @ApiProperty() termMonths!: number;
  @ApiProperty() monthlyInstallment!: number;
  @ApiProperty({ enum: LoanStatus }) status!: LoanStatus;
  @ApiPropertyOptional() purpose?: string | null;
  @ApiPropertyOptional() itemName?: string | null;
  @ApiPropertyOptional() supplierName?: string | null;
  @ApiPropertyOptional() itemCost?: number | null;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() issuedBy?: string | null;
  @ApiPropertyOptional() issuedAt?: Date | null;
  @ApiPropertyOptional() employeeAcknowledgedAt?: Date | null;
  @ApiPropertyOptional() disbursedAt?: Date | null;
  @ApiPropertyOptional() settledAt?: Date | null;
  @ApiPropertyOptional() clearedBy?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() outstandingBalance?: number | null;
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

export class IssueLoanResponseDto {
  @ApiProperty({ type: EmployeeLoanResponseDto }) loan!: EmployeeLoanResponseDto;
  @ApiProperty({ type: [LoanInstallmentResponseDto] }) installments!: LoanInstallmentResponseDto[];
}

export class LoanStatementResponseDto {
  @ApiProperty({ type: EmployeeLoanResponseDto }) loan!: EmployeeLoanResponseDto;
  @ApiProperty({ type: [LoanInstallmentResponseDto] }) installments!: LoanInstallmentResponseDto[];
  @ApiProperty() totalDue!: number;
  @ApiProperty() totalPaid!: number;
  @ApiProperty() outstandingBalance!: number;
  @ApiProperty() isSettled!: boolean;
}

export class LoanTypeOptionDto {
  @ApiProperty({ enum: LoanType }) value!: LoanType;
  @ApiProperty() label!: string;
  @ApiProperty() isItemLoan!: boolean;
}
