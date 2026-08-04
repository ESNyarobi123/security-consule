import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuardSupplyRequestStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class B2bPartnerProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class CreateGuardSupplyRequestDto {
  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  guardCount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  siteLocation?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  criteriaNotes?: string;
}

export class UpdateGuardSupplyRequestStatusDto {
  @ApiProperty({ enum: GuardSupplyRequestStatus })
  @IsEnum(GuardSupplyRequestStatus)
  status!: GuardSupplyRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNotes?: string;
}

export class GuardSupplyRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  partnerId!: string;

  @ApiPropertyOptional()
  partnerCode?: string | null;

  @ApiPropertyOptional()
  partnerName?: string | null;

  @ApiProperty()
  referenceNumber!: string;

  @ApiProperty()
  guardCount!: number;

  @ApiPropertyOptional()
  siteLocation?: string | null;

  @ApiPropertyOptional()
  startDate?: string | null;

  @ApiPropertyOptional()
  endDate?: string | null;

  @ApiPropertyOptional()
  criteriaNotes?: string | null;

  @ApiProperty({ enum: GuardSupplyRequestStatus })
  status!: GuardSupplyRequestStatus;

  @ApiPropertyOptional()
  processedBy?: string | null;

  @ApiPropertyOptional()
  processedAt?: string | null;

  @ApiPropertyOptional()
  staffNotes?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  createdBy?: string | null;
}
