import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  VerificationResult,
  VisitorEntryDirection,
  VisitorIdType,
} from '@prisma/client';

export class CreateVisitorAppointmentDto {
  @ApiPropertyOptional({ description: 'Required for public pre-registration' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  visitorName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  visitorEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitorPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hostUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  /** Module 12-D — both or neither with idNumber */
  @ApiPropertyOptional({ enum: VisitorIdType })
  @IsOptional()
  @IsEnum(VisitorIdType)
  idType?: VisitorIdType;

  /** Module 12-D — both or neither with idType; trimmed, max 64 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idNumber?: string;

  @ApiProperty()
  @IsDateString()
  validFrom!: string;

  @ApiProperty()
  @IsDateString()
  validUntil!: string;
}

export class RejectAppointmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class GateVerifyDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  code!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitorPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  visitorEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;
}

/** Module 12-B — gate exit punch (lookup by one of appointment/ref/code/IN entry). */
export class GateExitDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: GateExitDto) => !!o.appointmentId)
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: GateExitDto) => !!o.referenceNumber)
  @IsString()
  @MinLength(3)
  referenceNumber?: string;

  /** Plain verification code — resolved even when already used on entry. */
  @ApiPropertyOptional()
  @ValidateIf((o: GateExitDto) => !!o.verificationCode)
  @IsString()
  @MinLength(4)
  verificationCode?: string;

  /** ALLOWED IN entry id for the open visit. */
  @ApiPropertyOptional()
  @ValidateIf((o: GateExitDto) => !!o.entryId)
  @IsUUID()
  entryId?: string;
}

export class VisitorAppointmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiProperty()
  referenceNumber!: string;

  @ApiProperty()
  visitorName!: string;

  @ApiPropertyOptional()
  visitorEmail?: string | null;

  @ApiPropertyOptional()
  visitorPhone?: string | null;

  @ApiPropertyOptional()
  companyName?: string | null;

  @ApiProperty()
  purpose!: string;

  /** Module 12-D */
  @ApiPropertyOptional({ enum: VisitorIdType, nullable: true })
  idType?: VisitorIdType | null;

  @ApiPropertyOptional({ nullable: true })
  idNumber?: string | null;

  @ApiPropertyOptional()
  hostUserId?: string | null;

  @ApiPropertyOptional()
  hostName?: string | null;

  @ApiPropertyOptional()
  vehiclePlate?: string | null;

  @ApiProperty()
  validFrom!: Date;

  @ApiProperty()
  validUntil!: Date;

  @ApiProperty({ enum: AppointmentStatus })
  status!: AppointmentStatus;

  @ApiPropertyOptional()
  approvedBy?: string | null;

  @ApiPropertyOptional()
  approvedAt?: Date | null;

  @ApiPropertyOptional()
  rejectedReason?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;
}

/** Module 12-C — which channels were queued (honest; console adapters OK). */
export class GateCodeDeliveryDto {
  @ApiPropertyOptional({ description: 'EMAIL VISITOR_GATE_CODE queued' })
  email?: boolean;

  @ApiPropertyOptional({ description: 'SMS VISITOR_GATE_CODE queued' })
  sms?: boolean;

  @ApiPropertyOptional({
    description: 'WHATSAPP VISITOR_GATE_CODE queued (console adapter OK)',
  })
  whatsapp?: boolean;
}

export class IssueCodeResponseDto {
  @ApiProperty({ type: VisitorAppointmentResponseDto })
  appointment!: VisitorAppointmentResponseDto;

  @ApiProperty({ description: 'Plain code — shown once only' })
  verificationCode!: string;

  @ApiProperty()
  validUntil!: Date;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiPropertyOptional({
    type: GateCodeDeliveryDto,
    description: 'Channels queued for the plain gate code (12-C)',
  })
  delivery?: GateCodeDeliveryDto;
}

export class VisitorEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional()
  appointmentId?: string | null;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiProperty()
  visitorName!: string;

  @ApiProperty({ enum: VerificationResult })
  result!: VerificationResult;

  /** Module 12-B — IN (entry) or OUT (exit) */
  @ApiProperty({ enum: VisitorEntryDirection })
  direction!: VisitorEntryDirection;

  @ApiPropertyOptional()
  denyReason?: string | null;

  @ApiPropertyOptional()
  verifiedBy?: string | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  /** Module 12-D — denormalized from linked appointment when present */
  @ApiPropertyOptional({ enum: VisitorIdType, nullable: true })
  idType?: VisitorIdType | null;

  @ApiPropertyOptional({ nullable: true })
  idNumber?: string | null;
}

/** Module 12-E — host channels queued on gate deny (honest; console adapters OK). */
export class GateDenyHostNotifiedDto {
  @ApiPropertyOptional({ description: 'SMS VISITOR_GATE_DENIED_HOST queued' })
  sms?: boolean;

  @ApiPropertyOptional({ description: 'EMAIL VISITOR_GATE_DENIED_HOST queued' })
  email?: boolean;
}

export class GateVerifyResponseDto {
  @ApiProperty()
  allowed!: boolean;

  @ApiProperty({ enum: VerificationResult })
  result!: VerificationResult;

  @ApiProperty({ type: VisitorEntryResponseDto })
  entry!: VisitorEntryResponseDto;

  /** Module 12-A — FieldAlert id when deny raised ops alert; null on allow / idempotent replay */
  @ApiPropertyOptional({ nullable: true })
  fieldAlertId?: string | null;

  /**
   * Module 12-E — host notified when deny matched a known appointment + host contact.
   * Null/absent on allow / idempotent replay / unknown code (no appointmentId).
   */
  @ApiPropertyOptional({ type: GateDenyHostNotifiedDto, nullable: true })
  hostNotified?: GateDenyHostNotifiedDto | null;

  /** Module 12-D — from matched appointment (also on entry) */
  @ApiPropertyOptional({ enum: VisitorIdType, nullable: true })
  idType?: VisitorIdType | null;

  @ApiPropertyOptional({ nullable: true })
  idNumber?: string | null;
}

/** Module 12-B — successful exit punch response (no FieldAlert). */
export class GateExitResponseDto {
  @ApiProperty()
  allowed!: boolean;

  @ApiProperty({ description: 'Always true on success' })
  exited!: boolean;

  @ApiProperty({ enum: VerificationResult })
  result!: VerificationResult;

  @ApiProperty({ type: VisitorEntryResponseDto })
  entry!: VisitorEntryResponseDto;
}
