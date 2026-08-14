import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetLifecycleEventType, AssetStatus } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export const ASSET_CATEGORIES = [
  'VEHICLE',
  'RADIO',
  'UNIFORM',
  'SECURITY_BOOTS',
  'SMARTPHONE',
  'CCTV',
  'COMPUTER',
  'FIRE_EXTINGUISHER',
  'FURNITURE',
  'ACCESS_CONTROL_DEVICE',
  'PARKING_EQUIPMENT',
  'OTHER',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const RETURN_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export class CreateAssetDto {
  @ApiProperty({ example: 'AST-RADIO-001' })
  @IsString()
  assetTag!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ASSET_CATEGORIES })
  @IsOptional()
  @IsIn(ASSET_CATEGORIES)
  category?: AssetCategory;

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
  @ApiPropertyOptional() disposedAt?: Date | null;
  @ApiPropertyOptional() disposedBy?: string | null;
  @ApiPropertyOptional() disposalReason?: string | null;
  @ApiPropertyOptional() maintenanceNotes?: string | null;
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

export class TransferAssetDto extends AssignAssetDto {}

export class DisposeAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class MaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DamageAssetDto {
  @ApiPropertyOptional({ enum: RETURN_CONDITIONS })
  @IsOptional()
  @IsIn(RETURN_CONDITIONS)
  condition?: ReturnCondition;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  notes!: string;
}

export class ReplacementDto {
  @ApiProperty()
  @IsUUID()
  replacementAssetId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssetLifecycleEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty({ enum: AssetLifecycleEventType })
  eventType!: AssetLifecycleEventType;
  @ApiPropertyOptional() fromStatus?: string | null;
  @ApiPropertyOptional() toStatus?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() fromEmployeeId?: string | null;
  @ApiPropertyOptional() fromGuardId?: string | null;
  @ApiPropertyOptional() toEmployeeId?: string | null;
  @ApiPropertyOptional() toGuardId?: string | null;
  @ApiPropertyOptional() replacementAssetId?: string | null;
  @ApiPropertyOptional() condition?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() createdBy!: string;
}

export class CategoryOptionDto {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
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
