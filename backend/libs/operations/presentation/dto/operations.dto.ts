import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ShiftStatus } from '@prisma/client';

export class CreateShiftDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({ example: 'Night Shift A' }) @IsString() name!: string;
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiProperty() @IsDateString() endAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instructions?: string;
  @ApiProperty({ type: [String], description: 'Guard profile IDs' })
  @IsArray()
  @IsString({ each: true })
  guardIds!: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() supervisorId?: string;
}

export class ShiftAssignmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiPropertyOptional() employeeNumber?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() supervisorId?: string | null;
  @ApiProperty() assignedAt!: Date;
}

export class ShiftResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() startAt!: Date;
  @ApiProperty() endAt!: Date;
  @ApiProperty({ enum: ShiftStatus }) status!: ShiftStatus;
  @ApiPropertyOptional({ type: [ShiftAssignmentDto] })
  assignments?: ShiftAssignmentDto[];
}

export class ReplaceShiftAssignmentDto {
  @ApiProperty({ description: 'Guard profile that takes the post' })
  @IsString()
  replacementGuardId!: string;
}

export class CreateCheckpointDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({ example: 'CP-GATE-01' }) @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() qrCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nfcTagId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
}

export class CheckpointResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() siteCode?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() zone?: string | null;
  @ApiPropertyOptional() qrCode?: string | null;
  @ApiPropertyOptional() nfcTagId?: string | null;
  @ApiPropertyOptional() latitude?: number | null;
  @ApiPropertyOptional() longitude?: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() createdAt?: Date;
}

export class CreatePatrolRouteDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({ example: 'Night perimeter loop' }) @IsString() name!: string;
  @ApiProperty({
    type: [String],
    description: 'Ordered checkpoint IDs on this site',
  })
  @IsArray()
  @IsString({ each: true })
  checkpointIds!: string[];

  @ApiPropertyOptional({
    description:
      'Minutes from local midnight when route should be COMPLETED (0–1439). Default 1380 (23:00).',
    example: 1380,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  dueMinutesFromMidnight?: number;
}

export class PatrolRouteCheckpointDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class PatrolRouteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() siteCode?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String] }) checkpointIds!: string[];
  @ApiProperty({ type: [PatrolRouteCheckpointDto] })
  checkpoints!: PatrolRouteCheckpointDto[];
  @ApiProperty() checkpointCount!: number;
  @ApiProperty({ description: 'Distinct route checkpoints scanned today' })
  scannedToday!: number;
  @ApiProperty({
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    description: 'Today’s coverage vs route checkpoints',
  })
  coverageStatus!: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  @ApiProperty({
    enum: ['OK', 'ON_TRACK', 'LATE', 'MISSED'],
    description:
      'OK=completed; ON_TRACK=before due; LATE=past due no alert; MISSED=FieldAlert PATROL_MISSED open',
  })
  slaStatus!: 'OK' | 'ON_TRACK' | 'LATE' | 'MISSED';
  @ApiProperty({ description: 'Minutes from midnight when route is due' })
  dueMinutesFromMidnight!: number;
  @ApiProperty() dueAt!: Date;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Open PATROL_MISSED FieldAlert id for today, if any',
  })
  openPatrolAlertId?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class PatrolScanMissedResultDto {
  @ApiProperty() markedMissed!: number;
  @ApiProperty({ type: [String] }) routeIds!: string[];
  @ApiProperty({ type: [String] }) routeNames!: string[];
}

export class CreateDeploymentDto {
  @ApiProperty() @IsString() guardId!: string;
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({
    description:
      'Billable contract (APPROVED|ACTIVE|EXPIRING) that covers the site via ContractSite',
  })
  @IsString()
  contractId!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}

export class DeploymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() contractId!: string | null;
  @ApiPropertyOptional() contractNumber?: string | null;
  @ApiPropertyOptional() customerId?: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date | null;
}

export class CreateBranchPettyCashDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  purpose!: string;

  @ApiProperty({ example: 'TRANSPORT' })
  @IsString()
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;
}
