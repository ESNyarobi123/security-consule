import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  ServiceRequestCategory,
  ServiceRequestStatus,
  ServiceRequestUrgency,
} from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateServiceRequestDto {
  @ApiProperty({ enum: ServiceRequestCategory })
  @IsEnum(ServiceRequestCategory)
  category!: ServiceRequestCategory;

  @ApiPropertyOptional({
    enum: ServiceRequestUrgency,
    default: ServiceRequestUrgency.THIS_WEEK,
  })
  @IsOptional()
  @IsEnum(ServiceRequestUrgency)
  urgency?: ServiceRequestUrgency;

  @ApiProperty({ minLength: 3, maxLength: 160 })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ minLength: 10, maxLength: 4000 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  callbackPhone?: string;
}

export class UpdateServiceRequestStatusDto {
  @ApiProperty({ enum: ServiceRequestStatus })
  @IsEnum(ServiceRequestStatus)
  status!: ServiceRequestStatus;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}

export class ServiceRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: ServiceRequestCategory })
  category!: ServiceRequestCategory;
  @ApiProperty({ enum: ServiceRequestUrgency })
  urgency!: ServiceRequestUrgency;
  @ApiProperty({ enum: ServiceRequestStatus })
  status!: ServiceRequestStatus;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() siteId?: string | null;
  @ApiPropertyOptional() siteCode?: string | null;
  @ApiPropertyOptional() siteName?: string | null;
  @ApiPropertyOptional() callbackPhone?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() acknowledgedBy?: string | null;
  @ApiPropertyOptional() acknowledgedAt?: Date | null;
  @ApiPropertyOptional() resolvedBy?: string | null;
  @ApiPropertyOptional() resolvedAt?: Date | null;
  @ApiPropertyOptional() closedBy?: string | null;
  @ApiPropertyOptional() closedAt?: Date | null;
  @ApiPropertyOptional() resolutionNotes?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() customerCode?: string | null;
  @ApiPropertyOptional() customerName?: string | null;
}
