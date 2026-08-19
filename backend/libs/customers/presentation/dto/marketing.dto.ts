import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const MARKETING_CHANNELS = [
  'EMAIL',
  'SMS',
  'WHATSAPP',
  'EVENT',
  'BRANCH',
  'OTHER',
] as const;

export const MARKETING_SOURCES = [
  'CAMPAIGN',
  'REFERRAL',
  'WALK_IN',
  'BRANCH',
  'TENDER',
  'OTHER',
] as const;

export const MARKETING_STAGES = [
  'LEAD',
  'QUALIFIED',
  'SURVEY_SCHEDULED',
  'SURVEY_DONE',
  'QUOTED',
  'PROPOSAL',
  'WON',
  'LOST',
] as const;

export const MARKETING_REFERRER_TYPES = [
  'STAFF',
  'CUSTOMER',
  'PARTNER',
  'OTHER',
] as const;

export const MARKETING_QUOTE_KINDS = ['QUOTATION', 'PROPOSAL'] as const;

export const MARKETING_QUOTE_STATUSES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;

export const MARKETING_CONTRACT_SERVICES = [
  'SECURITY_GUARD',
  'CCTV_MONITORING',
  'VISITOR_MANAGEMENT',
  'ACCESS_CONTROL',
  'PARKING',
  'ALARM_RESPONSE',
  'RECRUITMENT',
  'CUSTOMER_PAYROLL',
  'TECHNICAL',
] as const;

export class CreateMarketingCampaignDto {
  @ApiPropertyOptional({ example: 'CMPG-GUARD-2026' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @ApiProperty({ example: 'Guard services Q3' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: MARKETING_CHANNELS })
  @IsOptional()
  @IsIn([...MARKETING_CHANNELS])
  channel?: (typeof MARKETING_CHANNELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMarketingCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: MARKETING_CHANNELS })
  @IsOptional()
  @IsIn([...MARKETING_CHANNELS])
  channel?: (typeof MARKETING_CHANNELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateMarketingLeadDto {
  @ApiProperty({ example: 'Kilimanjaro Logistics Ltd' })
  @IsString()
  @MinLength(2)
  companyName!: string;

  @ApiProperty({ example: 'Amina Juma' })
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ enum: MARKETING_SOURCES })
  @IsOptional()
  @IsIn([...MARKETING_SOURCES])
  source?: (typeof MARKETING_SOURCES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerName?: string;

  @ApiPropertyOptional({ enum: MARKETING_REFERRER_TYPES })
  @IsOptional()
  @IsIn([...MARKETING_REFERRER_TYPES])
  referrerType?: (typeof MARKETING_REFERRER_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PatchMarketingLeadDto {
  @ApiPropertyOptional({ enum: MARKETING_STAGES })
  @IsOptional()
  @IsIn([...MARKETING_STAGES])
  stage?: (typeof MARKETING_STAGES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string | null;
}

export class WinMarketingLeadDto {
  @ApiPropertyOptional({ description: 'Creates a PENDING commission when > 0' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commissionBeneficiary?: string;
}

export class LoseMarketingLeadDto {
  @ApiProperty({ example: 'Lost to incumbent' })
  @IsString()
  @MinLength(2)
  reason!: string;
}

export class CreateMarketingSurveyDto {
  @ApiProperty({ example: 'Plot 12, Nyerere Rd, DSM' })
  @IsString()
  @MinLength(4)
  siteAddress!: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteMarketingSurveyDto {
  @ApiProperty({ example: 'Viable — 8 posts recommended' })
  @IsString()
  @MinLength(2)
  outcome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMarketingQuoteDto {
  @ApiProperty({ enum: MARKETING_QUOTE_KINDS })
  @IsIn([...MARKETING_QUOTE_KINDS])
  kind!: (typeof MARKETING_QUOTE_KINDS)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsIn([...MARKETING_CONTRACT_SERVICES], { each: true })
  serviceTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PatchMarketingQuoteStatusDto {
  @ApiProperty({ enum: MARKETING_QUOTE_STATUSES })
  @IsIn([...MARKETING_QUOTE_STATUSES])
  status!: (typeof MARKETING_QUOTE_STATUSES)[number];
}

export class ConvertLeadCustomerDto {
  @ApiPropertyOptional({ description: 'Defaults to lead company name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class ConvertLeadContractDto {
  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyFee!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...MARKETING_CONTRACT_SERVICES], { each: true })
  serviceTypes!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNumber?: string;
}
