import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessLevel } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Module 6-G — create employee bound to :customerId (customerId forced server-side). */
export class CreateCustomerEmployeeForCustomerDto {
  @ApiProperty({ example: 'Maria Juma' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional({ example: 'EMP-1010' })
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  /** Module 11-B — STANDARD | RESTRICTED | ELEVATED */
  @ApiPropertyOptional({ enum: AccessLevel, default: AccessLevel.STANDARD })
  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  /** Module 6-K — gate / access device refs */
  @ApiPropertyOptional({ example: 'CARD-EMP-1010' })
  @IsOptional()
  @IsString()
  accessCardRef?: string;

  @ApiPropertyOptional({ example: 'BIO-EMP-1010' })
  @IsOptional()
  @IsString()
  biometricRef?: string;
}

/** Module 6-H — edit/deactivate; portal userId bind deferred. */
export class UpdateCustomerEmployeeForCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  employeeNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  department?: string | null;

  @ApiPropertyOptional({ enum: AccessLevel })
  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accessCardRef?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  biometricRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomerEmployeeStaffResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiPropertyOptional() userId?: string | null;
  @ApiPropertyOptional() employeeNumber?: string | null;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiProperty({ enum: AccessLevel }) accessLevel!: AccessLevel;
  @ApiPropertyOptional() accessCardRef?: string | null;
  @ApiPropertyOptional() biometricRef?: string | null;
  @ApiPropertyOptional() bankAccountRef?: string | null;
  @ApiPropertyOptional() bankName?: string | null;
  @ApiPropertyOptional() mobileMoneyRef?: string | null;
  @ApiPropertyOptional() mobileMoneyProvider?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}

/** Module 11-C — replace site grants (empty siteIds = unrestricted). */
export class SetCustomerEmployeeSitesDto {
  @ApiProperty({ type: [String], description: 'Empty = all customer sites' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  siteIds!: string[];
}

export class CustomerEmployeeSiteGrantDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}

export class CustomerEmployeeSitesResponseDto {
  @ApiProperty() employeeId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty({
    description: 'True when no grant rows — all active customer sites allowed',
  })
  unrestricted!: boolean;
  @ApiProperty({ type: [String] })
  siteIds!: string[];
  @ApiProperty({ type: [CustomerEmployeeSiteGrantDto] })
  sites!: CustomerEmployeeSiteGrantDto[];
}
