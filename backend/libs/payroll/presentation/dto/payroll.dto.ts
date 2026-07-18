import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollCycleStatus, PayrollTenantType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @ApiProperty() createdAt!: Date;
}

export class PayslipSnapshotResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() cycleId!: string;
  @ApiProperty() employeeId!: string;
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
