import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  B2bPartnerStatus,
  GuardSupplyGenderPreference,
  GuardSupplyRequestStatus,
  GuardSupplyUrgency,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
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

  @ApiPropertyOptional({
    description: 'Soft link to CRM customer for AR billing (Module 15-B)',
  })
  customerId?: string | null;

  @ApiPropertyOptional()
  customerCode?: string | null;

  @ApiPropertyOptional()
  customerName?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class RegisterB2bPartnerDto {
  @ApiProperty({ example: 'Coastal Guard Services Ltd' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ example: 'Asha Mwinyi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: 'ops@coastal-guard.co.tz' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RegisterB2bPartnerResponseDto {
  @ApiProperty()
  partnerId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  message!: string;
}

export class UpdateB2bPartnerStatusDto {
  @ApiProperty({ enum: [B2bPartnerStatus.APPROVED, B2bPartnerStatus.SUSPENDED] })
  @IsEnum(B2bPartnerStatus)
  status!: B2bPartnerStatus;
}

export class UpdateB2bPartnerCustomerDto {
  @ApiProperty({ description: 'CRM customer id for invoicing; null clears link' })
  @IsUUID()
  customerId!: string;
}

export class B2bCustomerOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class UpdateGuardSupplyRequestChargesDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  unitRatePerGuard!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class CreateGuardSupplyRequestDto {
  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  guardCount!: number;

  @ApiProperty({ example: 'Dar es Salaam — Industrial Zone A' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  siteLocation!: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'Valid guard licence, night shift, basic firearms clearance',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  qualifications?: string;

  @ApiPropertyOptional({
    example: 'Site induction and customer SOP briefing before deployment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trainingNeeds?: string;

  @ApiPropertyOptional({ enum: GuardSupplyUrgency })
  @IsOptional()
  @IsEnum(GuardSupplyUrgency)
  urgency?: GuardSupplyUrgency;

  @ApiPropertyOptional({
    example: '12-week cover, billed monthly, HIGHLINK uniforms on site',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  criteriaNotes?: string;

  /** Module 15-A */
  @ApiPropertyOptional({ minimum: 0, maximum: 40 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  experienceYearsMin?: number;

  @ApiPropertyOptional({ minimum: 18, maximum: 70 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(70)
  ageMin?: number;

  @ApiPropertyOptional({ minimum: 18, maximum: 70 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(70)
  ageMax?: number;

  @ApiPropertyOptional({
    enum: GuardSupplyGenderPreference,
    description: 'Optional preference only — where legally acceptable',
  })
  @IsOptional()
  @IsEnum(GuardSupplyGenderPreference)
  genderPreference?: GuardSupplyGenderPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  militaryTrainingRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firearmTrainingRequired?: boolean;

  @ApiPropertyOptional({ example: 'Swahili, English' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  languages?: string;

  @ApiPropertyOptional({ minimum: 140, maximum: 220 })
  @IsOptional()
  @IsInt()
  @Min(140)
  @Max(220)
  heightMinCm?: number;

  @ApiPropertyOptional({
    example: 'Medically fit for standing duty; no known mobility limits',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  healthConditionNotes?: string;
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
  qualifications?: string | null;

  @ApiPropertyOptional()
  trainingNeeds?: string | null;

  @ApiProperty({ enum: ['STANDARD', 'HIGH', 'CRITICAL'] })
  urgency!: string;

  @ApiPropertyOptional()
  serviceTerms?: string | null;

  @ApiPropertyOptional()
  criteriaNotes?: string | null;

  @ApiPropertyOptional()
  experienceYearsMin?: number | null;

  @ApiPropertyOptional()
  ageMin?: number | null;

  @ApiPropertyOptional()
  ageMax?: number | null;

  @ApiPropertyOptional({ enum: GuardSupplyGenderPreference })
  genderPreference?: string | null;

  @ApiProperty()
  militaryTrainingRequired!: boolean;

  @ApiProperty()
  firearmTrainingRequired!: boolean;

  @ApiPropertyOptional()
  languages?: string | null;

  @ApiPropertyOptional()
  heightMinCm?: number | null;

  @ApiPropertyOptional()
  healthConditionNotes?: string | null;

  @ApiPropertyOptional()
  unitRatePerGuard?: number | null;

  @ApiPropertyOptional()
  serviceFeeAmount?: number | null;

  @ApiPropertyOptional()
  currency?: string | null;

  @ApiPropertyOptional()
  discountAmount?: number | null;

  @ApiPropertyOptional()
  invoiceId?: string | null;

  @ApiPropertyOptional()
  billedAt?: string | null;

  @ApiPropertyOptional()
  invoiceNumber?: string | null;

  @ApiPropertyOptional()
  invoiceStatus?: string | null;

  @ApiPropertyOptional()
  amountPaid?: number | null;

  @ApiPropertyOptional()
  balanceDue?: number | null;

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
