import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DeviceCommandType,
  DeviceConnection,
  DeviceEventType,
  DeviceStatus,
  DeviceType,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterEdgeGatewayDto {
  @ApiProperty({ example: 'GW-HQ-01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'HQ Gate Edge Gateway' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;
}

export class RegisterDeviceDto {
  @ApiProperty({ example: 'FP-HQ-01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'HQ Reception Fingerprint' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: DeviceType })
  @IsEnum(DeviceType)
  type!: DeviceType;

  @ApiProperty({ enum: DeviceConnection })
  @IsEnum(DeviceConnection)
  connection!: DeviceConnection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateId?: string;

  @ApiPropertyOptional({ description: 'Attach to a registered edge gateway (USB devices)' })
  @IsOptional()
  @IsString()
  edgeGatewayId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Issue a direct device API key (network terminals that push on their own)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  directPush?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: DeviceStatus })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class IssueCommandDto {
  @ApiProperty({ enum: DeviceCommandType })
  @IsEnum(DeviceCommandType)
  type!: DeviceCommandType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Command expiry window (seconds)', default: 300 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(86_400)
  expiresInSeconds?: number;
}

export class HeartbeatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class IngestEventDto {
  @ApiProperty({ enum: DeviceEventType })
  @IsEnum(DeviceEventType)
  type!: DeviceEventType;

  @ApiProperty({ example: '2026-07-18T10:00:00.000Z' })
  @IsISO8601()
  capturedAt!: string;

  @ApiPropertyOptional({ description: 'Idempotency key — duplicates are ignored' })
  @IsOptional()
  @IsString()
  dedupeKey?: string;

  @ApiPropertyOptional({
    description: 'Device code (required when authenticating as an edge gateway)',
  })
  @IsOptional()
  @IsString()
  deviceCode?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class IngestEventsDto {
  @ApiProperty({ type: [IngestEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}

export class AckCommandDto {
  @ApiProperty({ enum: ['ACKED', 'FAILED'] })
  @IsEnum({ ACKED: 'ACKED', FAILED: 'FAILED' })
  status!: 'ACKED' | 'FAILED';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
