import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessEntryType, AccessLevel, AccessMethod } from '@prisma/client';

export class CreateCustomerEmployeeDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
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

  @ApiPropertyOptional({ enum: AccessLevel, default: AccessLevel.STANDARD })
  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessCardRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  biometricRef?: string;
}

/** Module 6-H — update/deactivate; userId bind deferred. */
export class UpdateCustomerEmployeeDto {
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

/** Module 19-A — bank / mobile money refs for customer payroll disbursement. */
export class UpdateCustomerEmployeePaymentDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  bankAccountRef?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  bankName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mobileMoneyRef?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mobileMoneyProvider?: string | null;
}

export class CustomerEmployeeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  employeeNumber?: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  department?: string | null;

  @ApiProperty({ enum: AccessLevel })
  accessLevel!: AccessLevel;

  @ApiPropertyOptional()
  accessCardRef?: string | null;

  @ApiPropertyOptional()
  biometricRef?: string | null;

  @ApiPropertyOptional()
  bankAccountRef?: string | null;

  @ApiPropertyOptional()
  bankName?: string | null;

  @ApiPropertyOptional()
  mobileMoneyRef?: string | null;

  @ApiPropertyOptional()
  mobileMoneyProvider?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class CreateAccessEntryDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiProperty({ enum: AccessEntryType })
  @IsEnum(AccessEntryType)
  entryType!: AccessEntryType;

  @ApiPropertyOptional({ enum: AccessMethod })
  @IsOptional()
  @IsEnum(AccessMethod)
  accessMethod?: AccessMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

/** Module 11-A — Portal 35.9 self check-in/out (employeeId/customerId from JWT bind). */
export class CreateSelfAccessEntryDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiPropertyOptional({
    enum: AccessEntryType,
    description: 'Omit to toggle from last entry (CHECK_IN ↔ CHECK_OUT)',
  })
  @IsOptional()
  @IsEnum(AccessEntryType)
  entryType?: AccessEntryType;

  @ApiPropertyOptional({
    enum: AccessMethod,
    description: 'Default QR for self-service thin slice',
  })
  @IsOptional()
  @IsEnum(AccessMethod)
  accessMethod?: AccessMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEventId?: string;
}

/** Module 11-D — gate at a granted site (self check-in picker). */
export class SelfAccessGateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

/** Module 11-C — sites allowed for self check-in (Portal 35.9). */
export class SelfAccessSiteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ type: [SelfAccessGateDto] })
  gates?: SelfAccessGateDto[];
}

export class SelfAccessSitesResponseDto {
  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  unrestricted!: boolean;

  @ApiProperty({ type: [String] })
  siteIds!: string[];

  @ApiProperty({ type: [SelfAccessSiteDto] })
  sites!: SelfAccessSiteDto[];
}

export class AccessEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional()
  gateId?: string | null;

  @ApiProperty({ enum: AccessEntryType })
  entryType!: AccessEntryType;

  @ApiProperty()
  accessMethod!: string;

  @ApiPropertyOptional()
  recordedBy?: string | null;

  @ApiProperty()
  recordedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  employeeName?: string | null;

  @ApiPropertyOptional()
  employeeNumber?: string | null;

  @ApiPropertyOptional()
  siteCode?: string | null;

  @ApiPropertyOptional()
  siteName?: string | null;

  @ApiPropertyOptional()
  gateCode?: string | null;

  @ApiPropertyOptional()
  gateName?: string | null;
}
