import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PurchaseOrderStatus,
  SupplierCategory,
  SupplierPaymentStatus,
  SupplierStatus,
  SupplierSubmissionKind,
  SupplierSubmissionStatus,
} from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @ApiProperty({ example: 'SUP-001' })
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: SupplierCategory })
  @IsOptional()
  @IsEnum(SupplierCategory)
  category?: SupplierCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileMoneyProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileMoneyRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;
}

export class RegisterSupplierDto {
  @ApiProperty({ example: 'Coastal Security Supplies Ltd' })
  @IsString()
  @MinLength(2)
  companyName!: string;

  @ApiProperty({ example: 'Asha Mwinyi' })
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiProperty({ example: 'asha@coastal-supplies.co.tz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: SupplierCategory })
  @IsOptional()
  @IsEnum(SupplierCategory)
  category?: SupplierCategory;
}

export class RegisterSupplierResponseDto {
  @ApiProperty() supplierId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
  @ApiProperty() email!: string;
  @ApiProperty() message!: string;
}

export class UpdateSupplierProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: SupplierCategory })
  @IsOptional()
  @IsEnum(SupplierCategory)
  category?: SupplierCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileMoneyProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileMoneyRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;
}

export class RejectSupplierDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class SupplierResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() tin?: string | null;
  @ApiPropertyOptional() vrn?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty({ enum: SupplierCategory }) category!: SupplierCategory;
  @ApiPropertyOptional() bankName?: string | null;
  @ApiPropertyOptional() bankAccountName?: string | null;
  @ApiPropertyOptional() bankAccountRef?: string | null;
  @ApiPropertyOptional() mobileMoneyProvider?: string | null;
  @ApiPropertyOptional() mobileMoneyRef?: string | null;
  @ApiPropertyOptional() contactPerson?: string | null;
  @ApiPropertyOptional() contactPhone?: string | null;
  @ApiPropertyOptional() contactEmail?: string | null;
  @ApiProperty({ enum: SupplierStatus }) status!: SupplierStatus;
  @ApiPropertyOptional() rejectedReason?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class CreateSupplierSubmissionDto {
  @ApiProperty({ enum: SupplierSubmissionKind })
  @IsEnum(SupplierSubmissionKind)
  kind!: SupplierSubmissionKind;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;
}

export class RejectSupplierSubmissionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class CreateSupplierMessageDto {
  @ApiProperty({ example: 'Please confirm delivery window for PO-DEMO-UNIFORM-001.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class SupplierMessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty({ enum: ['SUPPLIER', 'PROCUREMENT'] }) authorType!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() authorName?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class SupplierSubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() supplierId!: string;
  @ApiPropertyOptional() supplierCode?: string | null;
  @ApiPropertyOptional() supplierName?: string | null;
  @ApiPropertyOptional() purchaseOrderId?: string | null;
  @ApiPropertyOptional() poNumber?: string | null;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: SupplierSubmissionKind }) kind!: SupplierSubmissionKind;
  @ApiProperty({ enum: SupplierSubmissionStatus })
  status!: SupplierSubmissionStatus;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() amount?: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: SupplierPaymentStatus })
  paymentStatus!: SupplierPaymentStatus;
  @ApiPropertyOptional() rejectedReason?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() paidAt?: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
}

export class PurchaseOrderLineDto {
  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stockItemId?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ example: 'PO-2026-0001' })
  @IsString()
  poNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class PurchaseOrderLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitPrice!: number;
  @ApiProperty() amount!: number;
  @ApiProperty() receivedQty!: number;
  @ApiPropertyOptional() stockItemId?: string | null;
}

export class PurchaseOrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty() poNumber!: string;
  @ApiProperty({ enum: PurchaseOrderStatus }) status!: PurchaseOrderStatus;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() expectedDelivery?: Date | null;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiProperty({ type: [PurchaseOrderLineResponseDto] }) lines!: PurchaseOrderLineResponseDto[];
  @ApiProperty() createdAt!: Date;
}

export class GoodsReceiptLineDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderLineId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantityReceived!: number;
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiProperty({ type: [GoodsReceiptLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GoodsReceiptResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() purchaseOrderId!: string;
  @ApiProperty() grnNumber!: string;
  @ApiProperty() receivedAt!: Date;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class ThreeWayMatchResultDto {
  @ApiProperty() purchaseOrderId!: string;
  @ApiProperty() poNumber!: string;
  @ApiProperty() poTotal!: number;
  @ApiProperty() receivedValue!: number;
  @ApiProperty() payableAmount!: number;
  @ApiProperty() matched!: boolean;
  @ApiProperty({ type: [String] }) discrepancies!: string[];
}

export class PurchaseRequestLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional({ default: 'EA' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stockItemId?: string;
}

export class CreatePurchaseRequestDto {
  @ApiProperty({ example: 'Operations' })
  @IsString()
  @MinLength(2)
  department!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  purpose!: string;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [PurchaseRequestLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestLineDto)
  lines!: PurchaseRequestLineDto[];
}

export class PurchaseRequestQuoteLineDto {
  @ApiProperty()
  @IsUUID()
  purchaseRequestLineId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseRequestQuoteDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ type: [PurchaseRequestQuoteLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestQuoteLineDto)
  lines!: PurchaseRequestQuoteLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPurchaseRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ProcurementStatusCountDto {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

export class ProcurementReportResponseDto {
  @ApiProperty() suppliersTotal!: number;
  @ApiProperty() suppliersPending!: number;
  @ApiProperty() suppliersApproved!: number;
  @ApiProperty() purchaseRequestsTotal!: number;
  @ApiProperty() purchaseRequestsPendingApproval!: number;
  @ApiProperty() purchaseRequestsApproved!: number;
  @ApiProperty() purchaseOrdersOpen!: number;
  @ApiProperty() purchaseOrdersReceived!: number;
  @ApiProperty() goodsReceiptsTotal!: number;
  @ApiProperty() submissionsUnpaid!: number;
  @ApiProperty({ type: [ProcurementStatusCountDto] })
  purchaseRequestsByStatus!: ProcurementStatusCountDto[];
  @ApiProperty({ type: [ProcurementStatusCountDto] })
  purchaseOrdersByStatus!: ProcurementStatusCountDto[];
  @ApiProperty({ type: [String] }) notes!: string[];
}
