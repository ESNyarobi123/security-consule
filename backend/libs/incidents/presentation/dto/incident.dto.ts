import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

export const INCIDENT_CATEGORIES = [
  'SECURITY_BREACH',
  'THEFT',
  'VISITOR_ISSUE',
  'FAKE_VERIFICATION_CODE',
  'GUARD_MISCONDUCT',
  'CUSTOMER_COMPLAINT',
  'PARKING_INCIDENT',
  'VEHICLE_INCIDENT',
  'UNAUTHORIZED_VEHICLE_ACCESS',
  'PARKING_VIOLATION',
  'PAYROLL_DISPUTE',
  'SUPPLIER_DISPUTE',
  'SYSTEM_FAILURE',
  'ACCIDENT',
  'EMERGENCY',
  'EQUIPMENT_FAILURE',
  'DATA_BREACH',
  'PATROL_ISSUE',
  'CCTV_ALERT',
  // Existing integrations and seeded records.
  'ACCESS_BREACH',
  'PROPERTY_DAMAGE',
  'SUSPICIOUS_ACTIVITY',
  'OTHER',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  SECURITY_BREACH: 'Security breach',
  THEFT: 'Theft',
  VISITOR_ISSUE: 'Visitor issue',
  FAKE_VERIFICATION_CODE: 'Fake verification code',
  GUARD_MISCONDUCT: 'Guard misconduct',
  CUSTOMER_COMPLAINT: 'Customer complaint',
  PARKING_INCIDENT: 'Parking incident',
  VEHICLE_INCIDENT: 'Vehicle incident',
  UNAUTHORIZED_VEHICLE_ACCESS: 'Unauthorized vehicle access',
  PARKING_VIOLATION: 'Parking violation',
  PAYROLL_DISPUTE: 'Payroll dispute',
  SUPPLIER_DISPUTE: 'Supplier dispute',
  SYSTEM_FAILURE: 'System failure',
  ACCIDENT: 'Accident',
  EMERGENCY: 'Emergency',
  EQUIPMENT_FAILURE: 'Equipment failure',
  DATA_BREACH: 'Data breach',
  PATROL_ISSUE: 'Patrol issue',
  CCTV_ALERT: 'CCTV alert',
  ACCESS_BREACH: 'Access breach',
  PROPERTY_DAMAGE: 'Property damage',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity',
  OTHER: 'Other',
};

export class IncidentCategoryOptionDto {
  @ApiProperty() value!: string;
  @ApiProperty() label!: string;
}

export class IncidentOfficerOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class CreateIncidentDto {
  @ApiProperty() @IsUUID() siteId!: string;
  @ApiProperty({ enum: INCIDENT_CATEGORIES, example: 'SECURITY_BREACH' })
  @IsIn([...INCIDENT_CATEGORIES], { message: 'INVALID_INCIDENT_CATEGORY' })
  category!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @ApiProperty({ enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Specific place within the selected site' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationDescription?: string;

  @ApiPropertyOptional({ description: 'Officer initially responsible for the case' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'When the incident occurred' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deviceReportedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEventId?: string;
}

export class UpdateIncidentStatusDto {
  @ApiProperty({ enum: IncidentStatus })
  @IsEnum(IncidentStatus)
  status!: IncidentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string | null;

  @ApiPropertyOptional({ description: 'Operational action taken so far' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actionTaken?: string;

  @ApiPropertyOptional({ description: 'Required when marking RESOLVED' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolution?: string;

  @ApiPropertyOptional({
    description: 'Required authorized closure approval note when marking CLOSED',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closureApprovalNote?: string;
}

export class IncidentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() incidentNumber!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() siteCode?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: IncidentSeverity }) severity!: IncidentSeverity;
  @ApiProperty({ enum: IncidentStatus }) status!: IncidentStatus;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() reporterId!: string;
  @ApiPropertyOptional() reporterName?: string | null;
  @ApiPropertyOptional() assignedTo?: string | null;
  @ApiPropertyOptional() assignedToName?: string | null;
  @ApiPropertyOptional() locationDescription?: string | null;
  @ApiPropertyOptional() latitude?: number | null;
  @ApiPropertyOptional() longitude?: number | null;
  @ApiPropertyOptional() actionTaken?: string | null;
  @ApiPropertyOptional() resolution?: string | null;
  @ApiProperty() occurredAt!: Date;
  @ApiPropertyOptional() deviceReportedAt?: Date | null;
  @ApiPropertyOptional() resolvedAt?: Date | null;
  @ApiPropertyOptional() resolvedBy?: string | null;
  @ApiPropertyOptional() resolvedByName?: string | null;
  @ApiPropertyOptional() closedBy?: string | null;
  @ApiPropertyOptional() closedByName?: string | null;
  @ApiPropertyOptional() closedAt?: Date | null;
  @ApiPropertyOptional() closureApprovalNote?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({
    enum: IncidentStatus,
    isArray: true,
    description: 'Statuses the current user may advance to (A4b matrix)',
  })
  allowedNextStatuses!: IncidentStatus[];
  @ApiPropertyOptional({
    description: 'Why next escalate is blocked for this user, if any',
  })
  blockedReason?: string;
  @ApiPropertyOptional() requiredRoleHint?: string;
}
