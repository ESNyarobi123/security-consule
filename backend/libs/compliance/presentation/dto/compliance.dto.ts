import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BreachSeverity,
  BreachStatus,
  PolicyStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ example: 'POL-DPP-002' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'DATA_PROTECTION' })
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  body!: string;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  body?: string;
}

export class RejectPolicyDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class PolicyDocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() title!: string;
  @ApiProperty() category!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiProperty() body!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: PolicyStatus }) status!: PolicyStatus;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiPropertyOptional() publishedBy?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateBreachDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty({ enum: BreachSeverity })
  @IsEnum(BreachSeverity)
  severity!: BreachSeverity;

  @ApiProperty({ example: '2026-07-20T10:00:00.000Z' })
  @IsDateString()
  discoveredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affectedDataCategories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedRecords?: number;
}

export class UpdateBreachDto {
  @ApiPropertyOptional({ enum: BreachStatus })
  @IsOptional()
  @IsEnum(BreachStatus)
  status?: BreachStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  containmentNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affectedDataCategories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedRecords?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @ApiPropertyOptional({ enum: BreachSeverity })
  @IsOptional()
  @IsEnum(BreachSeverity)
  severity?: BreachSeverity;
}

export class DataBreachCaseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() referenceCode!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: BreachSeverity }) severity!: BreachSeverity;
  @ApiProperty({ enum: BreachStatus }) status!: BreachStatus;
  @ApiProperty() discoveredAt!: Date;
  @ApiProperty() reportedAt!: Date;
  @ApiPropertyOptional() affectedDataCategories?: string | null;
  @ApiPropertyOptional() estimatedRecords?: number | null;
  @ApiPropertyOptional() containmentNotes?: string | null;
  @ApiPropertyOptional() closedAt?: Date | null;
  @ApiPropertyOptional() closedBy?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
