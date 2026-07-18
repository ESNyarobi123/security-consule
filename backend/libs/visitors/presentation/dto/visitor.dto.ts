import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus, VerificationResult } from '@prisma/client';

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

  @ApiPropertyOptional()
  denyReason?: string | null;

  @ApiPropertyOptional()
  verifiedBy?: string | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class GateVerifyResponseDto {
  @ApiProperty()
  allowed!: boolean;

  @ApiProperty({ enum: VerificationResult })
  result!: VerificationResult;

  @ApiProperty({ type: VisitorEntryResponseDto })
  entry!: VisitorEntryResponseDto;
}
