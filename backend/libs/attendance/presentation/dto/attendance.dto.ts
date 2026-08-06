import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceMethod } from '@prisma/client';

export class GpsDto {
  @ApiProperty() @IsNumber() latitude!: number;
  @ApiProperty() @IsNumber() longitude!: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() gpsTime?: string;
}

export class ClockInDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiProperty({ enum: AttendanceMethod, default: AttendanceMethod.MOBILE_GPS })
  @IsEnum(AttendanceMethod)
  method!: AttendanceMethod;

  @ApiProperty({ type: GpsDto })
  @ValidateNested()
  @Type(() => GpsDto)
  gps!: GpsDto;

  @ApiPropertyOptional({ description: 'Device-reported time (offline sync)' })
  @IsOptional()
  @IsDateString()
  deviceTime?: string;

  @ApiPropertyOptional({ description: 'Client UUID for idempotent offline sync' })
  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class SupervisorClockInDto {
  @ApiProperty() @IsString() guardId!: string;
  @ApiProperty() @IsString() siteId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional({
    description: 'Supervisor note (e.g. mobile punch failure reason)',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    type: GpsDto,
    description: 'Optional GPS; when omitted site coordinates or 0,0 are used',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GpsDto)
  gps?: GpsDto;
}

export class ClockOutDto {
  @ApiProperty() @IsString() attendanceId!: string;
  @ApiProperty({ enum: AttendanceMethod })
  @IsEnum(AttendanceMethod)
  method!: AttendanceMethod;

  @ApiProperty({ type: GpsDto })
  @ValidateNested()
  @Type(() => GpsDto)
  gps!: GpsDto;

  @ApiPropertyOptional() @IsOptional() @IsDateString() deviceTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEventId?: string;
}

export class AttendanceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() clockInAt!: Date;
  @ApiPropertyOptional() clockOutAt?: Date | null;
  @ApiProperty() syncStatus!: string;
  @ApiPropertyOptional() geofenceVerified?: boolean;
  @ApiPropertyOptional({
    description:
      'Alertness checks auto-created after this clock-in (interval/random policy)',
  })
  alertnessChecksScheduled?: number;
}

export class AttendanceListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() shiftId?: string | null;
  @ApiProperty() clockInAt!: Date;
  @ApiPropertyOptional() clockOutAt?: Date | null;
  @ApiProperty() clockInMethod!: string;
  @ApiPropertyOptional() clockOutMethod?: string | null;
  @ApiProperty({
    description: 'True when remarks contains GEOFENCE_WARNING',
  })
  geofenceWarning!: boolean;
  @ApiProperty({
    description: 'Computed vs linked shift start; false when no shift',
  })
  isLate!: boolean;
  @ApiProperty({ description: 'Minutes after shift start; 0 when not late' })
  lateMinutes!: number;
  @ApiProperty({
    description: 'Computed vs linked shift end; false when no clock-out or shift',
  })
  isOvertime!: boolean;
  @ApiProperty({ description: 'Minutes after shift end; 0 when none' })
  overtimeMinutes!: number;
  @ApiProperty() supervisorApproved!: boolean;
  @ApiPropertyOptional() remarks?: string | null;
  @ApiProperty() syncStatus!: string;
}

export class FieldAlertResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() guardId?: string | null;
  @ApiProperty() alertType!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() message!: string;
  @ApiProperty() acknowledged!: boolean;
  @ApiPropertyOptional() acknowledgedBy?: string | null;
  @ApiProperty({
    description: 'AL1 escalation stage (SUPERVISOR→FIELD→BOM→CONTROL)',
    default: 'SUPERVISOR',
  })
  escalationStage!: string;
  @ApiPropertyOptional() escalatedAt?: Date | null;
  @ApiPropertyOptional() escalatedBy?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class ConfirmAlertnessDto {
  @ApiProperty() @IsString() alertnessCheckId!: string;
  @ApiProperty({ enum: AttendanceMethod })
  @IsEnum(AttendanceMethod)
  method!: AttendanceMethod;

  @ApiProperty({ type: GpsDto })
  @ValidateNested()
  @Type(() => GpsDto)
  gps!: GpsDto;

  @ApiPropertyOptional() @IsOptional() @IsDateString() deviceTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEventId?: string;
}

export class ScheduleAlertnessDto {
  @ApiProperty() @IsString() guardId!: string;
  @ApiProperty() @IsString() siteId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiProperty() @IsDateString() scheduledAt!: string;
}

/** Module 10-B — optional supervisor note when marking missed. */
export class MarkAlertnessMissedDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  supervisorRemarks?: string;
}

export class PatrolScanDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty() @IsString() checkpointId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() routeId?: string;
  @ApiProperty({ enum: AttendanceMethod })
  @IsEnum(AttendanceMethod)
  method!: AttendanceMethod;

  @ApiProperty({ type: GpsDto })
  @ValidateNested()
  @Type(() => GpsDto)
  gps!: GpsDto;

  @ApiPropertyOptional() @IsOptional() @IsDateString() deviceTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEventId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() qrOrNfcCode?: string;
}

export class FieldSyncEventDto {
  @ApiProperty({ example: 'CLOCK_IN' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Client-generated UUID for idempotency' })
  @IsString()
  clientEventId!: string;

  @ApiProperty() @IsDateString() deviceTime!: string;

  /** Event body (siteId, gps, …). Must have a class-validator decorator for whitelist. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class FieldSyncBatchDto {
  @ApiProperty({ type: [FieldSyncEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldSyncEventDto)
  events!: FieldSyncEventDto[];
}

export class FieldSyncResultDto {
  @ApiProperty() clientEventId!: string;
  @ApiProperty() status!: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';
  @ApiPropertyOptional() serverId?: string;
  @ApiPropertyOptional() message?: string;
}
