import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollCycleStatus, PayrollTenantType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class PayrollCustomerOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class CreatePayrollCycleDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional({ enum: PayrollTenantType })
  @IsOptional()
  @IsEnum(PayrollTenantType)
  tenantType?: PayrollTenantType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class MarkPayrollPaidDto {
  @ApiProperty({ example: 'BANK-TXN-20260714-001' })
  @IsString()
  paymentReference!: string;
}

export class PayrollCycleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ enum: PayrollTenantType }) tenantType!: PayrollTenantType;
  @ApiPropertyOptional() customerId?: string | null;
  @ApiProperty() cycleCode!: string;
  @ApiProperty() periodStart!: Date;
  @ApiProperty() periodEnd!: Date;
  @ApiProperty({ enum: PayrollCycleStatus }) status!: PayrollCycleStatus;
  @ApiProperty() ruleVersionId!: string;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() reviewedBy?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() paidAt?: Date | null;
  @ApiPropertyOptional() paymentReference?: string | null;
  @ApiPropertyOptional() billingInvoiceId?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class PayslipSnapshotResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() cycleId!: string;
  @ApiPropertyOptional() employeeId?: string | null;
  @ApiPropertyOptional() customerEmployeeId?: string | null;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty() employeeName!: string;
  @ApiProperty() inputsSnapshot!: unknown;
  @ApiProperty() allowancesSnapshot!: unknown;
  @ApiProperty() deductionsSnapshot!: unknown;
  @ApiProperty() calculationResult!: unknown;
  @ApiProperty() grossPay!: number;
  @ApiProperty() totalDeductions!: number;
  @ApiProperty() netPay!: number;
  @ApiProperty() ruleVersionId!: string;
  @ApiProperty() createdAt!: Date;
}

export class PayrollMoneyCountDto {
  @ApiProperty() count!: number;
  @ApiProperty() amount!: number;
}

export class PayrollTenantPackDto {
  @ApiProperty() cycles!: number;
  @ApiProperty() payslipSnapshots!: number;
  @ApiProperty() grossPay!: number;
  @ApiProperty() netPay!: number;
  @ApiProperty() overtime!: PayrollMoneyCountDto;
  @ApiProperty() allowances!: PayrollMoneyCountDto;
  @ApiProperty() loanDeductions!: PayrollMoneyCountDto;
  @ApiProperty() statutoryNssf!: number;
  @ApiProperty() statutoryPaye!: number;
  @ApiProperty() alertnessBonus!: number;
  @ApiProperty() alertnessPenalty!: number;
  @ApiProperty() alertnessMissed!: number;
}

export class PayrollPortalReportDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() company!: PayrollTenantPackDto;
  @ApiProperty() customer!: PayrollTenantPackDto;
  @ApiProperty() approvedNetPay!: number;
  @ApiProperty() unapprovedSnapshots!: number;
  @ApiProperty() dueAlertsOpen!: number;
  @ApiProperty({ type: [String] }) notes!: string[];
}
