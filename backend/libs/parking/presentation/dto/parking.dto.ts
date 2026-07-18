import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
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
}

export class CreateParkingEntryDto {
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
