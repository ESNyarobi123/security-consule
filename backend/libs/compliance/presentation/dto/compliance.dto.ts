import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BreachSeverity,
  BreachStatus,
  ConsentChannel,
  ConsentLawfulBasis,
  ConsentStatus,
  ConsentSubjectType,
  PolicyStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Design §32 policy domains — validated on create/update. */
export const POLICY_CATEGORIES = [
  'DATA_PROTECTION',
  'CYBERSECURITY',
  'EMPLOYMENT',
  'TAX',
  'CUSTOMER_CONFIDENTIALITY',
  'INTERNAL_POLICY',
  'CYBERCRIME',
  'OTHER',
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  DATA_PROTECTION: 'Data protection',
  CYBERSECURITY: 'Cybersecurity standards',
  EMPLOYMENT: 'Employment law',
  TAX: 'Tax requirements',
  CUSTOMER_CONFIDENTIALITY: 'Customer confidentiality',
  INTERNAL_POLICY: 'Internal company policy',
  CYBERCRIME: 'Cybercrime law',
  OTHER: 'Other',
};

/** Module 32-A consent processing purposes. */
export const CONSENT_PURPOSES = [
  'EMPLOYMENT_ADMIN',
  'ACCESS_CONTROL',
  'CCTV_MONITORING',
  'MARKETING',
  'PAYROLL',
  'VISITOR_MANAGEMENT',
  'RECRUITMENT',
  'CUSTOMER_SERVICE',
  'BIOMETRIC_PROCESSING',
  'OTHER',
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  EMPLOYMENT_ADMIN: 'Employment administration',
  ACCESS_CONTROL: 'Access control',
  CCTV_MONITORING: 'CCTV / monitoring',
  MARKETING: 'Marketing',
  PAYROLL: 'Payroll',
  VISITOR_MANAGEMENT: 'Visitor management',
  RECRUITMENT: 'Recruitment',
  CUSTOMER_SERVICE: 'Customer service',
  BIOMETRIC_PROCESSING: 'Biometric processing',
  OTHER: 'Other',
};

export class CatalogOptionDto {
  @ApiProperty() value!: string;
  @ApiProperty() label!: string;
}

export class CreatePolicyDto {
  @ApiProperty({ example: 'POL-DPP-002' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ enum: POLICY_CATEGORIES, example: 'DATA_PROTECTION' })
  @IsIn([...POLICY_CATEGORIES], { message: 'INVALID_POLICY_CATEGORY' })
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

  @ApiPropertyOptional({ enum: POLICY_CATEGORIES })
  @IsOptional()
  @IsIn([...POLICY_CATEGORIES], { message: 'INVALID_POLICY_CATEGORY' })
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

export class CreateConsentDto {
  @ApiProperty({ enum: ConsentSubjectType })
  @IsEnum(ConsentSubjectType)
  subjectType!: ConsentSubjectType;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subjectName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  subjectEmail?: string;

  @ApiPropertyOptional({ description: 'Employee/guard/visitor reference' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subjectRef?: string;

  @ApiProperty({ enum: CONSENT_PURPOSES })
  @IsIn([...CONSENT_PURPOSES], { message: 'INVALID_CONSENT_PURPOSE' })
  purpose!: string;

  @ApiProperty({ enum: ConsentLawfulBasis })
  @IsEnum(ConsentLawfulBasis)
  lawfulBasis!: ConsentLawfulBasis;

  @ApiProperty({ enum: ConsentChannel })
  @IsEnum(ConsentChannel)
  channel!: ConsentChannel;

  @ApiProperty({ example: '2026-08-01T08:00:00.000Z' })
  @IsDateString()
  grantedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class WithdrawConsentDto {
  @ApiProperty({ description: 'Why consent is withdrawn (required)' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class ConsentRecordResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() referenceCode!: string;
  @ApiProperty({ enum: ConsentSubjectType }) subjectType!: ConsentSubjectType;
  @ApiProperty() subjectName!: string;
  @ApiPropertyOptional() subjectEmail?: string | null;
  @ApiPropertyOptional() subjectRef?: string | null;
  @ApiProperty() purpose!: string;
  @ApiProperty({ enum: ConsentLawfulBasis }) lawfulBasis!: ConsentLawfulBasis;
  @ApiProperty({ enum: ConsentChannel }) channel!: ConsentChannel;
  @ApiProperty({ enum: ConsentStatus }) status!: ConsentStatus;
  @ApiProperty() grantedAt!: Date;
  @ApiPropertyOptional() expiresAt?: Date | null;
  @ApiPropertyOptional() withdrawnAt?: Date | null;
  @ApiPropertyOptional() withdrawnBy?: string | null;
  @ApiPropertyOptional() withdrawnByName?: string | null;
  @ApiPropertyOptional() withdrawReason?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() createdByName?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

/** Portal 35.21 risk / regulatory catalogs (string columns + IsIn). */
export const RISK_CATEGORIES = [
  'OPERATIONAL',
  'DATA_PROTECTION',
  'CYBER',
  'FINANCIAL',
  'LEGAL_REGULATORY',
  'PEOPLE',
  'PHYSICAL_SECURITY',
  'OTHER',
] as const;

export const RISK_CATEGORY_LABELS: Record<(typeof RISK_CATEGORIES)[number], string> =
  {
    OPERATIONAL: 'Operational',
    DATA_PROTECTION: 'Data protection',
    CYBER: 'Cybersecurity',
    FINANCIAL: 'Financial',
    LEGAL_REGULATORY: 'Legal / regulatory',
    PEOPLE: 'People / HR',
    PHYSICAL_SECURITY: 'Physical security',
    OTHER: 'Other',
  };

export const REGULATORY_FRAMEWORKS = [
  'PDPA_TANZANIA',
  'CYBERCRIME_ACT',
  'EMPLOYMENT_LAW',
  'TRA_TAX',
  'CONTRACT_SLA',
  'ISO_27001',
  'INTERNAL_POLICY',
  'OTHER',
] as const;

export const REGULATORY_FRAMEWORK_LABELS: Record<
  (typeof REGULATORY_FRAMEWORKS)[number],
  string
> = {
  PDPA_TANZANIA: 'Personal Data Protection Act (TZ)',
  CYBERCRIME_ACT: 'Cybercrime Act',
  EMPLOYMENT_LAW: 'Employment / labour law',
  TRA_TAX: 'TRA / tax requirements',
  CONTRACT_SLA: 'Customer contract / SLA',
  ISO_27001: 'ISO 27001 (reference)',
  INTERNAL_POLICY: 'Internal published policy',
  OTHER: 'Other',
};

export class CreateRiskDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ enum: RISK_CATEGORIES })
  @IsIn([...RISK_CATEGORIES], { message: 'INVALID_RISK_CATEGORY' })
  category!: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ enum: REGULATORY_FRAMEWORKS })
  @IsOptional()
  @IsIn([...REGULATORY_FRAMEWORKS], { message: 'INVALID_REGULATORY_REF' })
  regulatoryRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mitigation?: string;
}

export class UpdateRiskDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED'])
  status?: 'OPEN' | 'MITIGATING' | 'ACCEPTED' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ enum: RISK_CATEGORIES })
  @IsOptional()
  @IsIn([...RISK_CATEGORIES], { message: 'INVALID_RISK_CATEGORY' })
  category?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ enum: REGULATORY_FRAMEWORKS })
  @IsOptional()
  @IsIn([...REGULATORY_FRAMEWORKS], { message: 'INVALID_REGULATORY_REF' })
  regulatoryRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mitigation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  residualNotes?: string | null;
}

export class RiskRegisterItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() referenceCode!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() category!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() regulatoryRef?: string | null;
  @ApiPropertyOptional() mitigation?: string | null;
  @ApiPropertyOptional() residualNotes?: string | null;
  @ApiPropertyOptional() ownerUserId?: string | null;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() createdByName?: string | null;
  @ApiPropertyOptional() closedBy?: string | null;
  @ApiPropertyOptional() closedByName?: string | null;
  @ApiPropertyOptional() closedAt?: Date | null;
  @ApiProperty() allowedNextStatuses!: string[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
