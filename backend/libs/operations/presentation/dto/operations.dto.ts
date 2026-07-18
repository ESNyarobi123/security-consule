import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
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

export class ShiftResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() startAt!: Date;
  @ApiProperty() endAt!: Date;
  @ApiProperty({ enum: ShiftStatus }) status!: ShiftStatus;
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
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() qrCode?: string | null;
  @ApiPropertyOptional() nfcTagId?: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CreateDeploymentDto {
  @ApiProperty() @IsString() guardId!: string;
  @ApiProperty() @IsString() siteId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractId?: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}

export class DeploymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() startDate!: Date;
}
