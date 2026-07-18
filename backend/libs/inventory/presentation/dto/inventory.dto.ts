import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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
  @ApiProperty() createdAt!: Date;
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
