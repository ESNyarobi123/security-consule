import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Design §21 — invoices cover all approved security services. */
export const INVOICE_SERVICE_TYPES = [
  'SECURITY_GUARD',
  'CCTV_MONITORING',
  'ACCESS_CONTROL',
  'VISITOR_MANAGEMENT',
  'PARKING',
  'RECRUITMENT',
  'CUSTOMER_PAYROLL',
  'ALARM_RESPONSE',
  'TECHNICAL',
  'OTHER',
] as const;

export type InvoiceServiceType = (typeof INVOICE_SERVICE_TYPES)[number];

export class InvoiceLineDto {
  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({ example: 'INV-2026-0001' })
  @IsString()
  invoiceNumber!: string;

  @ApiProperty()
  @IsDateString()
  issueDate!: string;

  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Service covered (defaults from contract when linked)',
    example: 'SECURITY_GUARD',
    enum: INVOICE_SERVICE_TYPES,
  })
  @IsOptional()
  @IsIn([...INVOICE_SERVICE_TYPES])
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

export class InvoiceLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitPrice!: number;
  @ApiProperty() amount!: number;
}

export class InvoiceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiPropertyOptional() contractId?: string | null;
  @ApiPropertyOptional() contractNumber?: string | null;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty() issueDate!: Date;
  @ApiProperty() dueDate!: Date;
  @ApiProperty() subtotal!: number;
  @ApiProperty() taxAmount!: number;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() amountPaid!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() serviceType?: string | null;
  @ApiProperty({ enum: InvoiceStatus }) status!: InvoiceStatus;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty({ type: [InvoiceLineResponseDto] }) lines!: InvoiceLineResponseDto[];
  @ApiProperty() createdAt!: Date;
}

export class RecordInvoicePaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: 'BANK-TXN-001' })
  @IsString()
  paymentReference!: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class VoidInvoiceDto {
  @ApiPropertyOptional({ example: 'Duplicate / superseded by INV-…' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

export class DisputeInvoiceDto {
  @ApiPropertyOptional({ example: 'Customer disputes visitor-management hours' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

export class InvoiceScanOverdueResultDto {
  @ApiProperty() markedOverdue!: number;
  @ApiProperty({ type: [String] }) invoiceNumbers!: string[];
  @ApiProperty() overdueNotified!: number;
  @ApiProperty() unpaidReminders!: number;
  @ApiProperty() suspensionRisks!: number;
}

export class InvoiceAlertItemDto {
  @ApiProperty() kind!: string;
  @ApiPropertyOptional() invoiceId?: string;
  @ApiPropertyOptional() invoiceNumber?: string | null;
  @ApiPropertyOptional() customerId?: string | null;
  @ApiPropertyOptional() customerName?: string | null;
  @ApiPropertyOptional() serviceType?: string | null;
  @ApiPropertyOptional() status?: string | null;
  @ApiPropertyOptional() amount?: number | null;
  @ApiPropertyOptional() dueDate?: Date | null;
  @ApiProperty() message!: string;
}

export class InvoiceAlertsPackDto {
  @ApiProperty({ type: [InvoiceAlertItemDto] }) overdue!: InvoiceAlertItemDto[];
  @ApiProperty({ type: [InvoiceAlertItemDto] }) unpaid!: InvoiceAlertItemDto[];
  @ApiProperty({ type: [InvoiceAlertItemDto] }) completedPayments!: InvoiceAlertItemDto[];
  @ApiProperty({ type: [InvoiceAlertItemDto] }) payrollDueInvoices!: InvoiceAlertItemDto[];
  @ApiProperty({ type: [InvoiceAlertItemDto] }) contractExpiry!: InvoiceAlertItemDto[];
  @ApiProperty({ type: [InvoiceAlertItemDto] }) suspensionRisk!: InvoiceAlertItemDto[];
}

export class CreatePettyCashFundDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  imprestAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  custodianId?: string;
}

export class PettyCashFundResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() imprestAmount!: number;
  @ApiProperty() currentBalance!: number;
  @ApiPropertyOptional() custodianId?: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CreatePettyCashVoucherDto {
  @ApiProperty()
  @IsUUID()
  fundId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  purpose!: string;

  @ApiProperty({ example: 'TRANSPORT' })
  @IsString()
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

/** ESS / thin create — fund resolved by service (default active imprest). */
export class CreateEssPettyCashVoucherDto {
  @ApiProperty()
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
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class RejectPettyCashVoucherDto {
  @ApiProperty({ example: 'Insufficient justification' })
  @IsString()
  @MinLength(3)
  reason!: string;
}

/**
 * Retire after cash issue: ISSUED → REIMBURSED (receipt/retirement).
 * At least one of receiptUrl or notes is required (auditable signal).
 * MinIO files attach via /documents (resourceType PettyCashVoucher); UI stores
 * receiptUrl as document:{id} when a file is uploaded.
 */
export class ReimbursePettyCashVoucherDto {
  @ApiPropertyOptional({
    example: 'document:clx… or https://files.example/receipts/pcv-00012.jpg',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  receiptUrl?: string;

  @ApiPropertyOptional({
    example: 'Cash receipt #4412 — stationery, HQ store',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}

export class PettyCashVoucherResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() fundId!: string;
  @ApiPropertyOptional() fundName?: string | null;
  @ApiPropertyOptional() fundBalance?: number | null;
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
  @ApiPropertyOptional() rejectedReason?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
}

export class CreatePaymentVoucherDto {
  @ApiProperty()
  @IsString()
  payeeName!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class PaymentVoucherResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() voucherNumber!: string;
  @ApiProperty() payeeName!: string;
  @ApiPropertyOptional() supplierId?: string | null;
  @ApiPropertyOptional() purchaseOrderId?: string | null;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() purpose!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() paidAt?: Date | null;
  @ApiPropertyOptional() paymentReference?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
}

export class PayVoucherDto {
  @ApiProperty()
  @IsString()
  paymentReference!: string;
}

export class FinanceMoneyCountDto {
  @ApiProperty() count!: number;
  @ApiProperty() amount!: number;
}

export class FinanceReportResponseDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() invoicesIssued!: FinanceMoneyCountDto;
  @ApiProperty() customerReceipts!: FinanceMoneyCountDto;
  @ApiProperty() outstanding!: FinanceMoneyCountDto;
  @ApiProperty() parkingBilled!: FinanceMoneyCountDto;
  @ApiProperty() parkingReceipts!: FinanceMoneyCountDto;
  @ApiProperty() pettyCashIssued!: FinanceMoneyCountDto;
  @ApiProperty() pettyCashRetired!: FinanceMoneyCountDto;
  @ApiProperty() supplierPayments!: FinanceMoneyCountDto;
  @ApiProperty() paymentVouchersPaid!: FinanceMoneyCountDto;
  @ApiProperty() bankReconciliationImplemented!: boolean;
  @ApiProperty({ type: [String] }) notes!: string[];
}
