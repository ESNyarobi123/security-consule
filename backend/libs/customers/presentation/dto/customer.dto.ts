import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const CUSTOMER_LIFECYCLE_STATUSES = [
  'PROSPECT',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
] as const;

export type CustomerLifecycleStatusDto =
  (typeof CUSTOMER_LIFECYCLE_STATUSES)[number];

export class CreateCustomerDto {
  @ApiPropertyOptional({
    example: 'CUST-ACME-001',
    description: 'Omit to auto-generate CUST-XXXX',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @ApiProperty({ example: 'ABC Industries Ltd' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradingName?: string;

  @ApiPropertyOptional({ enum: ['CORPORATE', 'GOVERNMENT', 'NGO', 'RESIDENTIAL', 'INDUSTRIAL', 'VIP'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'IMPORTANT', 'STRATEGIC', 'VIP'] })
  @IsOptional()
  @IsString()
  ranking?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_LIFECYCLE_STATUSES })
  @IsOptional()
  @IsIn([...CUSTOMER_LIFECYCLE_STATUSES])
  status?: CustomerLifecycleStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessLicense?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'Tanzania' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactDesignation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  opsEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ type: [String], example: ['GUARD', 'CCTV'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  preferredStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedGuards?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequirements?: string;

  @ApiPropertyOptional({ enum: ['STANDARD', 'PREMIUM', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  slaLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceFrequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountManagerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Save as Prospect draft — relaxed required fields',
  })
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradingName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ranking?: string | null;

  @ApiPropertyOptional({ enum: CUSTOMER_LIFECYCLE_STATUSES })
  @IsOptional()
  @IsIn([...CUSTOMER_LIFECYCLE_STATUSES])
  status?: CustomerLifecycleStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vrn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessLicense?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactDesignation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  billingEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  opsEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  preferredStartDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedGuards?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequirements?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slaLevel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTerms?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceFrequency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountManagerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomerSiteSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CustomerResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() tradingName?: string | null;
  @ApiPropertyOptional() tin?: string | null;
  @ApiPropertyOptional() vrn?: string | null;
  @ApiPropertyOptional() businessLicense?: string | null;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() altPhone?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiPropertyOptional() postalAddress?: string | null;
  @ApiPropertyOptional() city?: string | null;
  @ApiPropertyOptional() region?: string | null;
  @ApiPropertyOptional() country?: string | null;
  @ApiPropertyOptional() contactPerson?: string | null;
  @ApiPropertyOptional() contactDesignation?: string | null;
  @ApiPropertyOptional() billingEmail?: string | null;
  @ApiPropertyOptional() opsEmail?: string | null;
  @ApiPropertyOptional() website?: string | null;
  @ApiPropertyOptional() category?: string | null;
  @ApiPropertyOptional() industry?: string | null;
  @ApiPropertyOptional() ranking?: string | null;
  @ApiPropertyOptional() status?: CustomerLifecycleStatusDto;
  @ApiPropertyOptional({ type: [String] }) serviceTypes?: string[];
  @ApiPropertyOptional() preferredStartDate?: Date | string | null;
  @ApiPropertyOptional() estimatedGuards?: number | null;
  @ApiPropertyOptional() specialRequirements?: string | null;
  @ApiPropertyOptional() slaLevel?: string | null;
  @ApiPropertyOptional() paymentTerms?: string | null;
  @ApiPropertyOptional() paymentMethod?: string | null;
  @ApiPropertyOptional() bankName?: string | null;
  @ApiPropertyOptional() accountNumber?: string | null;
  @ApiPropertyOptional() creditLimit?: string | null;
  @ApiPropertyOptional() currency?: string | null;
  @ApiPropertyOptional() invoiceFrequency?: string | null;
  @ApiPropertyOptional() taxExempt?: boolean;
  @ApiPropertyOptional() accountManagerName?: string | null;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() updatedAt?: Date;
  @ApiPropertyOptional() siteCount?: number;
  @ApiPropertyOptional() contractCount?: number;
  @ApiPropertyOptional({ type: [CustomerSiteSummaryDto] })
  sites?: CustomerSiteSummaryDto[];
}
