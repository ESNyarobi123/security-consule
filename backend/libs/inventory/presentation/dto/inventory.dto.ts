import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Design §25 / Portal 35.18 stock classes (bulk store — issued serialized kit stays on /assets). */
export const STOCK_CATEGORIES = [
  'UNIFORMS',
  'SECURITY_BOOTS',
  'SMARTPHONES',
  'RADIOS',
  'CCTV',
  'PARKING',
  'OFFICE',
  'ACCESS_DEVICES',
  'OTHER',
] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

const STOCK_CATEGORY_ALIASES: Record<string, StockCategory> = {
  BOOTS: 'SECURITY_BOOTS',
  STATIONERY: 'OFFICE',
  UNIFORM: 'UNIFORMS',
  RADIO: 'RADIOS',
  PHONE: 'SMARTPHONES',
  SMARTPHONE: 'SMARTPHONES',
};

export function resolveStockCategory(
  raw?: string | null,
): StockCategory | undefined {
  if (raw == null || !raw.trim()) return undefined;
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if ((STOCK_CATEGORIES as readonly string[]).includes(key)) {
    return key as StockCategory;
  }
  return STOCK_CATEGORY_ALIASES[key];
}

export class CreateStockItemDto {
  @ApiProperty({ example: 'UNIFORM-L' })
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: 'EA' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reorderLevel?: number;
}

export class StockItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() category?: string | null;
  @ApiProperty() unit!: string;
  @ApiPropertyOptional() reorderLevel?: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() onHand!: number;
  @ApiProperty() belowReorder!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class UpdateStockItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reorderLevel?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStockMovementDto {
  @ApiProperty()
  @IsUUID()
  stockItemId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockMovementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() stockItemId!: string;
  @ApiPropertyOptional() siteId?: string | null;
  @ApiProperty({ enum: StockMovementType }) movementType!: StockMovementType;
  @ApiProperty() quantity!: number;
  @ApiPropertyOptional() referenceType?: string | null;
  @ApiPropertyOptional() referenceId?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class StockCategoryOptionDto {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class InventoryCategoryCountDto {
  @ApiProperty() category!: string;
  @ApiProperty() items!: number;
  @ApiProperty() onHand!: number;
}

export class InventoryReportResponseDto {
  @ApiProperty() itemsTotal!: number;
  @ApiProperty() itemsActive!: number;
  @ApiProperty() belowReorder!: number;
  @ApiProperty() onHandUnits!: number;
  @ApiProperty({ type: [InventoryCategoryCountDto] })
  byCategory!: InventoryCategoryCountDto[];
  @ApiProperty({ type: [String] }) notes!: string[];
}
