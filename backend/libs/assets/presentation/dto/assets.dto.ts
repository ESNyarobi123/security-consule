import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const RETURN_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

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

export class ActiveAssignmentSummaryDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() assignedToEmployeeId?: string | null;
  @ApiPropertyOptional() assignedToGuardId?: string | null;
  @ApiProperty() assignedAt!: Date;
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
  @ApiPropertyOptional({ type: ActiveAssignmentSummaryDto })
  activeAssignment?: ActiveAssignmentSummaryDto | null;
}

export class AssetAssigneeOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty() fullName!: string;
}

export class AssetAssigneeOptionsDto {
  @ApiProperty({ type: [AssetAssigneeOptionDto] })
  employees!: AssetAssigneeOptionDto[];

  @ApiProperty({ type: [AssetAssigneeOptionDto] })
  guards!: AssetAssigneeOptionDto[];
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

export class ConfirmReturnDto {
  @ApiProperty({ enum: RETURN_CONDITIONS })
  @IsIn(RETURN_CONDITIONS)
  condition!: ReturnCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNote?: string;
}

export class WalkInReturnDto {
  @ApiPropertyOptional({ enum: RETURN_CONDITIONS })
  @IsOptional()
  @IsIn(RETURN_CONDITIONS)
  condition?: ReturnCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNote?: string;
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
  @ApiPropertyOptional() returnRequestedAt?: Date | null;
  @ApiPropertyOptional() returnRequestedBy?: string | null;
  @ApiPropertyOptional() returnCondition?: string | null;
  @ApiPropertyOptional() returnReceiptNote?: string | null;
  @ApiPropertyOptional() returnConfirmedBy?: string | null;
  @ApiPropertyOptional() returnConfirmedAt?: Date | null;
  @ApiPropertyOptional() assetTag?: string | null;
  @ApiPropertyOptional() assetName?: string | null;
  @ApiPropertyOptional() assetCategory?: string | null;
  @ApiPropertyOptional({ enum: AssetStatus }) assetStatus?: AssetStatus | null;
}
