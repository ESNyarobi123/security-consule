import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
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
}

export class AttendanceListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() shiftId?: string | null;
  @ApiProperty() clockInAt!: Date;
  @ApiPropertyOptional() clockOutAt?: Date | null;
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
