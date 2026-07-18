import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'AST-RADIO-001' })
  @IsString()
  assetTag!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;
}

export class AssetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() assetTag!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() category?: string | null;
  @ApiPropertyOptional() purchaseDate?: Date | null;
  @ApiPropertyOptional() purchaseCost?: number | null;
  @ApiPropertyOptional() serialNumber?: string | null;
  @ApiProperty({ enum: AssetStatus }) status!: AssetStatus;
  @ApiProperty() createdAt!: Date;
}

export class AssignAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToGuardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssetAssignmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() assetId!: string;
  @ApiPropertyOptional() assignedToEmployeeId?: string | null;
  @ApiPropertyOptional() assignedToGuardId?: string | null;
  @ApiProperty() assignedAt!: Date;
  @ApiPropertyOptional() returnedAt?: Date | null;
  @ApiPropertyOptional() notes?: string | null;
}
