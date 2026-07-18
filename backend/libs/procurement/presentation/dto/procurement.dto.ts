import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrderStatus, SupplierStatus } from '@prisma/client';
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
  address?: string;
}

export class SupplierResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() tin?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty({ enum: SupplierStatus }) status!: SupplierStatus;
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
  @ApiProperty()
  @IsUUID()
  purchaseOrderId!: string;

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
