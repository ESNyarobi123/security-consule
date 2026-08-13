import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollDueAlertStatus } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class PayrollDueAlertResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiPropertyOptional() customerName?: string;
  @ApiPropertyOptional() customerCode?: string;
  @ApiProperty() payrollCycleId!: string;
  @ApiPropertyOptional() cycleCode?: string;
  @ApiPropertyOptional() invoiceId?: string | null;
  @ApiPropertyOptional() invoiceNumber?: string | null;
  @ApiProperty() payrollMonth!: string;
  @ApiProperty() invoiceAmountPaid!: number;
  @ApiProperty() employeesCovered!: number;
  @ApiProperty() payrollPortionDue!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() dueDate!: Date;
  @ApiProperty() invoicePaymentStatus!: string;
  @ApiProperty() payrollApprovalStatus!: string;
  @ApiProperty() payrollPaymentStatus!: string;
  @ApiPropertyOptional() responsibleOfficerId?: string | null;
  @ApiPropertyOptional() responsibleOfficerName?: string | null;
  @ApiProperty({ enum: PayrollDueAlertStatus }) status!: PayrollDueAlertStatus;
  @ApiPropertyOptional() notifiedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class PayrollInvoiceGateDto {
  @ApiProperty() eligible!: boolean;
  @ApiPropertyOptional() blockedReason?: string | null;
  @ApiPropertyOptional() blockedCode?: string | null;
  @ApiPropertyOptional() invoiceId?: string | null;
  @ApiPropertyOptional() invoiceNumber?: string | null;
  @ApiPropertyOptional() invoiceStatus?: string | null;
  @ApiPropertyOptional() amountPaid?: number | null;
  @ApiPropertyOptional() totalAmount?: number | null;
  @ApiPropertyOptional() exceptionApproved?: boolean;
}

export class GrantPayrollPayExceptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PayrollDueScanResultDto {
  @ApiProperty() scanned!: number;
  @ApiProperty() alertsCreated!: number;
  @ApiProperty() notificationsQueued!: number;
  @ApiProperty() skippedUnpaid!: number;
  @ApiProperty() skippedAlreadyPaid!: number;
}
