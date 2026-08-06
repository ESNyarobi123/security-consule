import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ParkingDecision,
  ParkingEntryDirection,
  PermitType,
  VehicleType,
  ViolationType,
} from '@prisma/client';

export class CreateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ example: 'T123ABC' })
  @IsString()
  @MinLength(3)
  plateNumber!: string;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  /** Module 13-A — optional RFID / tag ref */
  @ApiPropertyOptional({ example: 'RFID-DEMO-T123' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  rfidTagRef?: string;
}

/** Module 13-A — patch RFID + basic editable vehicle fields */
export class UpdateVehicleDto {
  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  make?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  model?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  color?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  ownerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  ownerPhone?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'RFID-DEMO-T123',
    description: 'Pass null to clear RFID tag',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(3)
  rfidTagRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class VehicleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional()
  customerId?: string | null;

  @ApiProperty()
  plateNumber!: string;

  @ApiProperty()
  vehicleType!: string;

  @ApiPropertyOptional()
  make?: string | null;

  @ApiPropertyOptional()
  model?: string | null;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiPropertyOptional()
  ownerName?: string | null;

  @ApiPropertyOptional()
  ownerPhone?: string | null;

  @ApiPropertyOptional({ example: 'RFID-DEMO-T123' })
  rfidTagRef?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class CreateParkingPermitDto {
  @ApiProperty()
  @IsUUID()
  vehicleId!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty()
  @IsString()
  permitNumber!: string;

  @ApiProperty({ enum: PermitType })
  @IsEnum(PermitType)
  permitType!: PermitType;

  @ApiProperty()
  @IsDateString()
  validFrom!: string;

  @ApiProperty()
  @IsDateString()
  validUntil!: string;

  /** Module 13-B — optional fee (bill creates DRAFT invoice separately) */
  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @ApiPropertyOptional({ default: 'TZS', example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateParkingPermitDto {
  @ApiPropertyOptional({
    description: 'Permit fee; null clears (blocked once billed)',
    nullable: true,
    example: 150000,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  feeAmount?: number | null;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdatePermitStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'REVOKED', 'SUSPENDED'])
  status!: 'ACTIVE' | 'REVOKED' | 'SUSPENDED';
}

export class ParkingPermitResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  vehicleId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  permitNumber!: string;

  @ApiProperty()
  permitType!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  validFrom!: Date;

  @ApiProperty()
  validUntil!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  feeAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  currency?: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  billedAt?: Date | null;

  @ApiPropertyOptional()
  plateNumber?: string | null;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;
}

export class CreateAnprResultDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiProperty()
  @IsString()
  plateNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cameraId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;

  @ApiProperty()
  @IsDateString()
  capturedAt!: string;
}

export class DecideAnprResultDto {
  @ApiProperty({ enum: ParkingDecision })
  @IsEnum(ParkingDecision)
  decision!: ParkingDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denyReason?: string;
}

export class AnprResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiProperty()
  plateNumber!: string;

  @ApiPropertyOptional()
  confidence?: number | null;

  @ApiPropertyOptional()
  cameraId?: string | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiProperty()
  decision!: string;

  @ApiPropertyOptional()
  decidedBy?: string | null;

  @ApiPropertyOptional()
  decidedAt?: Date | null;

  @ApiPropertyOptional()
  denyReason?: string | null;

  @ApiProperty()
  capturedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;
}

export class CreateParkingEntryDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  /** Required unless rfidTagRef resolves a vehicle (Module 13-A). */
  @ApiPropertyOptional({ example: 'T123ABC' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  /** Module 13-A — resolve vehicle by org-scoped RFID tag when plate omitted. */
  @ApiPropertyOptional({ example: 'RFID-DEMO-T123' })
  @IsOptional()
  @IsString()
  rfidTagRef?: string;

  @ApiProperty({ enum: ParkingEntryDirection })
  @IsEnum(ParkingEntryDirection)
  direction!: ParkingEntryDirection;

  @ApiPropertyOptional({ enum: ParkingDecision })
  @IsOptional()
  @IsEnum(ParkingDecision)
  decision?: ParkingDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class ParkingEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiPropertyOptional()
  vehicleId?: string | null;

  @ApiProperty()
  plateNumber!: string;

  @ApiProperty()
  direction!: string;

  @ApiPropertyOptional()
  permitId?: string | null;

  @ApiProperty()
  decision!: string;

  @ApiPropertyOptional()
  recordedBy?: string | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;
}

export class CreateParkingViolationDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty()
  @IsString()
  plateNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({ enum: ViolationType })
  @IsEnum(ViolationType)
  violationType!: ViolationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ParkingViolationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  plateNumber!: string;

  @ApiPropertyOptional()
  vehicleId?: string | null;

  @ApiProperty()
  violationType!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;
}

export class CreateVehicleBlacklistDto {
  @ApiProperty({ example: 'BLACKLIST1' })
  @IsString()
  @MinLength(3)
  plateNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class VehicleBlacklistResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  plateNumber!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
