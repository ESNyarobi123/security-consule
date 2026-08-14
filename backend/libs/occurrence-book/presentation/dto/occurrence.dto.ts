import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

/**
 * EOB event category catalog (design §30): handover notes, visitor issues,
 * vehicle issues, parking violations, incidents, patrol observations,
 * customer instructions, lost property, emergency events, supervisor comments.
 * ROUTINE / EQUIPMENT / OTHER kept for legacy rows + general site log use.
 */
export const EOB_CATEGORIES = [
  'HANDOVER_NOTE',
  'VISITOR_ISSUE',
  'VEHICLE_ISSUE',
  'PARKING_VIOLATION',
  'INCIDENT',
  'PATROL_OBSERVATION',
  'CUSTOMER_INSTRUCTION',
  'LOST_PROPERTY',
  'EMERGENCY_EVENT',
  'SUPERVISOR_COMMENT',
  'ROUTINE',
  'EQUIPMENT',
  'OTHER',
] as const;

export type EobCategory = (typeof EOB_CATEGORIES)[number];

export const EOB_CATEGORY_LABELS: Record<EobCategory, string> = {
  HANDOVER_NOTE: 'Guard handover note',
  VISITOR_ISSUE: 'Visitor issue',
  VEHICLE_ISSUE: 'Vehicle issue',
  PARKING_VIOLATION: 'Parking violation',
  INCIDENT: 'Incident',
  PATROL_OBSERVATION: 'Patrol observation',
  CUSTOMER_INSTRUCTION: 'Customer instruction',
  LOST_PROPERTY: 'Lost property',
  EMERGENCY_EVENT: 'Emergency event',
  SUPERVISOR_COMMENT: 'Supervisor comment',
  ROUTINE: 'Routine log',
  EQUIPMENT: 'Equipment note',
  OTHER: 'Other',
};

export class EobCategoryOptionDto {
  @ApiProperty({ example: 'HANDOVER_NOTE' }) value!: string;
  @ApiProperty({ example: 'Guard handover note' }) label!: string;
}

export class CreateOccurrenceDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ enum: EOB_CATEGORIES, example: 'VISITOR_ISSUE' })
  @IsString()
  @IsIn([...EOB_CATEGORIES], { message: 'INVALID_EOB_CATEGORY' })
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty()
  @IsDateString()
  recordedAt!: string;
}

export class CorrectOccurrenceDto {
  @ApiProperty({ description: 'Why this correction is needed (required)' })
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional({ enum: EOB_CATEGORIES })
  @IsOptional()
  @IsString()
  @IsIn([...EOB_CATEGORIES], { message: 'INVALID_EOB_CATEGORY' })
  category?: string;
}

export class OccurrenceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() siteCode?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiProperty() category!: string;
  @ApiProperty() description!: string;
  @ApiProperty() version!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiPropertyOptional() correctionReason?: string | null;
  @ApiPropertyOptional() officerId?: string | null;
  @ApiPropertyOptional({ description: 'Recording officer full name' })
  officerName?: string | null;
  @ApiPropertyOptional({
    description: 'Null until second-person approve',
    nullable: true,
  })
  approvedBy?: string | null;
  @ApiPropertyOptional({ description: 'Approver full name', nullable: true })
  approvedByName?: string | null;
  @ApiProperty() recordedAt!: Date;
  @ApiProperty() createdAt!: Date;
}

/** One version in an append-only occurrence lineage (history timeline). */
export class OccurrenceHistoryVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() version!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() category!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() correctionReason?: string | null;
  @ApiPropertyOptional() officerId?: string | null;
  @ApiPropertyOptional({ description: 'Recording officer full name' })
  officerName?: string | null;
  @ApiProperty() recordedAt!: Date;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() parentEntryId?: string | null;
  @ApiPropertyOptional({
    description: 'Null until second-person approve',
    nullable: true,
  })
  approvedBy?: string | null;
  @ApiPropertyOptional({ description: 'Approver full name', nullable: true })
  approvedByName?: string | null;
}
