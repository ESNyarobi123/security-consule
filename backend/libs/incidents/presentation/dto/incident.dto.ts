import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

export class CreateIncidentDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({ example: 'SECURITY_BREACH' }) @IsString() category!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty({ enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deviceReportedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEventId?: string;
}

export class UpdateIncidentStatusDto {
  @ApiProperty({ enum: IncidentStatus })
  @IsEnum(IncidentStatus)
  status!: IncidentStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
}

export class IncidentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() incidentNumber!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: IncidentSeverity }) severity!: IncidentSeverity;
  @ApiProperty({ enum: IncidentStatus }) status!: IncidentStatus;
  @ApiProperty() title!: string;
  @ApiProperty() createdAt!: Date;
}
