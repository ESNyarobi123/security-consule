import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
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
import { EmployeeStatus, EmploymentType, LoanType } from '@prisma/client';

const ESS_ITEM_LOAN_TYPES: LoanType[] = [
  LoanType.SECURITY_BOOTS,
  LoanType.SMARTPHONE,
  LoanType.UNIFORM,
  LoanType.EQUIPMENT,
];

export class EssProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiProperty({ enum: EmploymentType }) employmentType!: EmploymentType;
  @ApiProperty({ enum: EmployeeStatus }) status!: EmployeeStatus;
  @ApiPropertyOptional() hireDate?: Date | null;
  @ApiPropertyOptional() guardProfileId?: string | null;
}

export class EssApplyLeaveDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  days!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class EssApplyLoanDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  purpose?: string;

  @ApiPropertyOptional({ example: 'Security boots size 42' })
  @ValidateIf((o: EssApplyLoanDto) => ESS_ITEM_LOAN_TYPES.includes(o.loanType))
  @IsString()
  @MinLength(2)
  itemName?: string;
}

/** Design: Requesting Employee creates petty cash voucher (not AP payment voucher). */
export class EssApplyPettyCashDto {
  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  purpose!: string;

  @ApiProperty({ example: 'TRANSPORT' })
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  department?: string;
}

export class EssPettyCashVoucherResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() fundId!: string;
  @ApiProperty() voucherNumber!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() purpose!: string;
  @ApiProperty() category!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() receiptUrl?: string | null;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() issuedBy?: string | null;
  @ApiPropertyOptional() issuedAt?: Date | null;
  @ApiPropertyOptional() reimbursedAt?: Date | null;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiPropertyOptional() branchCode?: string | null;
  @ApiPropertyOptional() branchName?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
}

export class EssPayslipResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() cycleId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty() employeeName!: string;
  @ApiProperty() grossPay!: number;
  @ApiProperty() totalDeductions!: number;
  @ApiProperty() netPay!: number;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() inputsSnapshot?: unknown;
  @ApiPropertyOptional() allowancesSnapshot?: unknown;
  @ApiPropertyOptional() deductionsSnapshot?: unknown;
  @ApiPropertyOptional() calculationResult?: unknown;
}

export class EssEquipmentResponseDto {
  @ApiProperty() assignmentId!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty() assetTag!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() category?: string | null;
  @ApiProperty() assignedAt!: Date;
  @ApiPropertyOptional() notes?: string | null;
  /** ASSIGNED | RETURN_REQUESTED (queue awaiting storekeeper confirm). */
  @ApiProperty({ enum: ['ASSIGNED', 'RETURN_REQUESTED'] })
  status!: 'ASSIGNED' | 'RETURN_REQUESTED';
  @ApiPropertyOptional() returnRequestedAt?: Date | null;
}

export class EssRequestItemDto {
  @ApiProperty({ enum: ['LEAVE', 'LOAN', 'MOVEMENT', 'PETTY_CASH'] })
  kind!: 'LEAVE' | 'LOAN' | 'MOVEMENT' | 'PETTY_CASH';

  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() detail?: string | null;
  @ApiPropertyOptional() href?: string | null;
}
