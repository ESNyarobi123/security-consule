import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({ enum: ComplaintCategory })
  @IsEnum(ComplaintCategory)
  category!: ComplaintCategory;

  @ApiPropertyOptional({
    enum: ComplaintSeverity,
    default: ComplaintSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ComplaintSeverity)
  severity?: ComplaintSeverity;

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

/** Staff logging a walk-in / phone complaint for a customer. */
export class CreateStaffComplaintDto extends CreateComplaintDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;
}

export class UpdateComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus })
  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}

export class ComplaintResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: ComplaintCategory })
  category!: ComplaintCategory;
  @ApiProperty({ enum: ComplaintSeverity })
  severity!: ComplaintSeverity;
  @ApiProperty({ enum: ComplaintStatus })
  status!: ComplaintStatus;
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
