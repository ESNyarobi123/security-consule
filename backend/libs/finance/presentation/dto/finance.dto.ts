import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty() issueDate!: Date;
  @ApiProperty() dueDate!: Date;
  @ApiProperty() subtotal!: number;
  @ApiProperty() taxAmount!: number;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() amountPaid!: number;
  @ApiProperty() currency!: string;
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
  @IsString()
  receiptUrl?: string;
}

export class PettyCashVoucherResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() fundId!: string;
  @ApiProperty() voucherNumber!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() purpose!: string;
  @ApiProperty() category!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() reimbursedAt?: Date | null;
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
  @ApiProperty() createdAt!: Date;
}

export class PayVoucherDto {
  @ApiProperty()
  @IsString()
  paymentReference!: string;
}
