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
  ParkingViolationStatus,
  ParkingCategory,
  ParkingSpaceType,
  ParkingSpaceStatus,
  ParkingAllocationMode,
  ParkingVerificationMethod,
  ParkingPatrolObservationType,
  ParkingBillingPeriod,
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

  /** Module 13-I — portal forced to CUSTOMER */
  @ApiPropertyOptional({ enum: ParkingCategory })
  @IsOptional()
  @IsEnum(ParkingCategory)
  parkingCategory?: ParkingCategory;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(7)
  driverPhone?: string;

  /** Module 13-A — optional RFID / tag ref */
  @ApiPropertyOptional({ example: 'RFID-DEMO-T123' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  rfidTagRef?: string;
}

/** Module 13-A/E/I — patch RFID + profile + category + driver */
export class UpdateVehicleDto {
  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ enum: ParkingCategory })
  @IsOptional()
  @IsEnum(ParkingCategory)
  parkingCategory?: ParkingCategory;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  driverName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsString()
  @MinLength(7)
  driverPhone?: string | null;

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

  @ApiProperty({ enum: ParkingCategory })
  parkingCategory!: string;

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

  @ApiPropertyOptional()
  driverName?: string | null;

  @ApiPropertyOptional()
  driverPhone?: string | null;

  @ApiPropertyOptional({ example: 'RFID-DEMO-T123' })
  rfidTagRef?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

/** Module 13-E — thin customer picker for ops vehicle register */
export class ParkingCustomerOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;
}

/** Module 13-F — thin site + gates picker for manual gate punch */
export class ParkingGateOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class ParkingSiteOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [ParkingGateOptionDto] })
  gates!: ParkingGateOptionDto[];
}

export class CreateParkingPermitDto {
  @ApiProperty()
  @IsUUID()
  vehicleId!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  /** Ops may supply; portal requests auto-generate `PRM-REQ-…`. */
  @ApiPropertyOptional({ example: 'PRM-00042' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  permitNumber?: string;

  @ApiProperty({ enum: PermitType })
  @IsEnum(PermitType)
  permitType!: PermitType;

  /** Defaults to now when omitted (portal 13-D). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  /** Defaults to +1 year when omitted (portal 13-D). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  /** Module 13-B — optional fee (bill creates DRAFT invoice separately). Ignored for portal. */
  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @ApiPropertyOptional({ default: 'TZS', example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  /** Module 13-O — ONE_TIME / DAILY / MONTHLY */
  @ApiPropertyOptional({ enum: ParkingBillingPeriod })
  @IsOptional()
  @IsEnum(ParkingBillingPeriod)
  billingPeriod?: ParkingBillingPeriod;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Rate per day / month / one-time unit',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitRate?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Days or months; auto from validity when omitted for DAILY/MONTHLY',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyAmount?: number;

  /** Module 13-H — optional link to APPROVED/COMPLETED visitor appointment */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visitorAppointmentId?: string;
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

  @ApiPropertyOptional({ enum: ParkingBillingPeriod })
  @IsOptional()
  @IsEnum(ParkingBillingPeriod)
  billingPeriod?: ParkingBillingPeriod;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  unitRate?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  quantity?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  penaltyAmount?: number | null;
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

  @ApiPropertyOptional({ enum: ParkingBillingPeriod })
  billingPeriod?: string;

  @ApiPropertyOptional({ nullable: true })
  unitRate?: number | null;

  @ApiPropertyOptional({ nullable: true })
  quantity?: number | null;

  @ApiPropertyOptional({ nullable: true })
  discountAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  penaltyAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber?: string | null;

  /** Module 13-O — from finance invoice */
  @ApiPropertyOptional({ nullable: true })
  invoiceStatus?: string | null;

  @ApiPropertyOptional({ nullable: true })
  amountPaid?: number | null;

  @ApiPropertyOptional({ nullable: true })
  balanceDue?: number | null;

  @ApiPropertyOptional({ nullable: true })
  billedAt?: Date | null;

  @ApiPropertyOptional()
  plateNumber?: string | null;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;

  /** Module 13-H */
  @ApiPropertyOptional({ nullable: true })
  visitorAppointmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  visitorReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  visitorName?: string | null;
}

/** Module 13-H — thin appointment picker for VISITOR/CONTRACTOR permits */
export class ParkingVisitorAppointmentOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  referenceNumber!: string;

  @ApiProperty()
  visitorName!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  vehiclePlate?: string | null;

  @ApiProperty()
  validFrom!: Date;

  @ApiProperty()
  validUntil!: Date;
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

  /** Module 13-L — visit record */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: 'Driver ID / licence / NIDA ref' })
  @IsOptional()
  @IsString()
  driverIdRef?: string;

  @ApiPropertyOptional({ enum: ParkingVerificationMethod })
  @IsOptional()
  @IsEnum(ParkingVerificationMethod)
  verificationMethod?: ParkingVerificationMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purposeOfVisit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visitorAppointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parkingSpaceId?: string;
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

  @ApiPropertyOptional()
  gateCode?: string | null;

  @ApiPropertyOptional()
  gateName?: string | null;

  /** Module 13-K — primary FieldAlert id when gate event raised ops alert */
  @ApiPropertyOptional({ nullable: true })
  fieldAlertId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  fieldAlertIds?: string[];

  /** Module 13-L */
  @ApiPropertyOptional({ nullable: true })
  driverName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  driverIdRef?: string | null;

  @ApiPropertyOptional({ enum: ParkingVerificationMethod })
  verificationMethod?: string;

  @ApiPropertyOptional({ nullable: true })
  purposeOfVisit?: string | null;

  @ApiPropertyOptional({ nullable: true })
  visitorAppointmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  visitorReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  visitorName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  parkingSpaceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  parkingSpaceCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pairedEntryId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  entryTime?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  exitTime?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  entryGateCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  exitGateCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  recordedByName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerName?: string | null;
}

export class CreateParkingViolationDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'T123ABC' })
  @IsString()
  @MinLength(3)
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

  @ApiPropertyOptional({ description: 'Module 13-N — gate officer remarks' })
  @IsOptional()
  @IsString()
  officerRemarks?: string;

  /** Module 13-P — optional fine (bill creates finance invoice) */
  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fineAmount?: number;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class ResolveParkingViolationDto {
  @ApiPropertyOptional({ example: 'Warned driver; released after permit check' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsString()
  @MinLength(3)
  resolutionNotes?: string;
}

/** Module 13-N/P — update remarks / corrective / fine while not billed */
export class UpdateParkingViolationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officerRemarks?: string;

  @ApiPropertyOptional({ example: 'Vehicle relocated; warning issued' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsString()
  @MinLength(3)
  correctiveAction?: string;

  @ApiPropertyOptional({ nullable: true, example: 50000 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  fineAmount?: number | null;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;
}

/** Module 13-N — approve closure (creator ≠ approver, submitter ≠ approver) */
export class ApproveParkingViolationClosureDto {
  @ApiPropertyOptional({ example: 'Supervisor verified tow completed' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsString()
  @MinLength(3)
  approvalNotes?: string;

  @ApiPropertyOptional({ example: 'Case closed — no further action' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsString()
  @MinLength(3)
  closureNotes?: string;
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

  @ApiPropertyOptional({ nullable: true })
  officerRemarks?: string | null;

  @ApiPropertyOptional({ nullable: true })
  correctiveAction?: string | null;

  @ApiPropertyOptional({ nullable: true })
  correctiveActionAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  correctiveActionBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  submittedForClosureAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  submittedForClosureBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvalNotes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  closureNotes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  closedBy?: string | null;

  @ApiProperty({ enum: ParkingViolationStatus })
  status!: string;

  @ApiPropertyOptional()
  resolvedAt?: Date | null;

  @ApiPropertyOptional()
  resolvedBy?: string | null;

  @ApiPropertyOptional()
  resolutionNotes?: string | null;

  /** Module 13-P */
  @ApiPropertyOptional({ nullable: true })
  fineAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  currency?: string | null;

  @ApiPropertyOptional({ nullable: true })
  discountAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  netFineAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceStatus?: string | null;

  @ApiPropertyOptional({ nullable: true })
  amountPaid?: number | null;

  @ApiPropertyOptional({ nullable: true })
  balanceDue?: number | null;

  @ApiPropertyOptional({ nullable: true })
  billedAt?: Date | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string | null;

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

/** Module 13-J — create bay / stall */
export class CreateParkingSpaceDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'A-12' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ enum: ParkingSpaceType })
  @IsEnum(ParkingSpaceType)
  spaceType!: ParkingSpaceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: ParkingAllocationMode })
  @IsOptional()
  @IsEnum(ParkingAllocationMode)
  allocationMode?: ParkingAllocationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateParkingSpaceDto {
  @ApiPropertyOptional({ enum: ParkingSpaceType })
  @IsOptional()
  @IsEnum(ParkingSpaceType)
  spaceType?: ParkingSpaceType;

  @ApiPropertyOptional({ enum: ParkingAllocationMode })
  @IsOptional()
  @IsEnum(ParkingAllocationMode)
  allocationMode?: ParkingAllocationMode;

  @ApiPropertyOptional({
    enum: ParkingSpaceStatus,
    description: 'AVAILABLE or OUT_OF_SERVICE only when not OCCUPIED',
  })
  @IsOptional()
  @IsEnum(ParkingSpaceStatus)
  status?: ParkingSpaceStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Manual or auto allocation in one body */
export class AllocateParkingSpaceDto {
  @ApiProperty({ enum: ParkingAllocationMode })
  @IsEnum(ParkingAllocationMode)
  mode!: ParkingAllocationMode;

  @ApiProperty()
  @IsUUID()
  vehicleId!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  /** Required when mode=MANUAL */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  /** Optional hint for AUTO (else inferred from vehicle parkingCategory) */
  @ApiPropertyOptional({ enum: ParkingSpaceType })
  @IsOptional()
  @IsEnum(ParkingSpaceType)
  spaceType?: ParkingSpaceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  permitId?: string;
}

export class ParkingSpaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional({ nullable: true })
  customerId?: string | null;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  label?: string | null;

  @ApiProperty({ enum: ParkingSpaceType })
  spaceType!: string;

  @ApiProperty({ enum: ParkingSpaceStatus })
  status!: string;

  @ApiProperty({ enum: ParkingAllocationMode })
  allocationMode!: string;

  @ApiPropertyOptional({ nullable: true })
  vehicleId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  permitId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  allocatedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  allocatedBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;

  @ApiPropertyOptional()
  plateNumber?: string | null;

  @ApiPropertyOptional()
  customerCode?: string | null;

  @ApiPropertyOptional()
  customerName?: string | null;
}

/** Module 13-M — guard parking inspection */
export class CreateParkingPatrolObservationDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'Lot A · Visitor bay' })
  @IsString()
  @MinLength(1)
  parkingArea!: string;

  @ApiProperty({ enum: ParkingPatrolObservationType })
  @IsEnum(ParkingPatrolObservationType)
  observationType!: ParkingPatrolObservationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parkingSpaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  inspectedAt?: string;

  @ApiPropertyOptional({ description: 'Ops-only when actor is not a guard' })
  @IsOptional()
  @IsUUID()
  guardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class ParkingPatrolObservationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  guardId!: string;

  @ApiProperty()
  inspectedAt!: Date;

  @ApiProperty()
  parkingArea!: string;

  @ApiProperty({ enum: ParkingPatrolObservationType })
  observationType!: string;

  @ApiPropertyOptional({ nullable: true })
  plateNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  vehicleId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  parkingSpaceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty()
  severity!: string;

  @ApiPropertyOptional({ nullable: true })
  latitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude?: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  fieldAlertId?: string | null;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;

  @ApiPropertyOptional()
  guardEmployeeNumber?: string | null;

  @ApiPropertyOptional()
  parkingSpaceCode?: string | null;
}
