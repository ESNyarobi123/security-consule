import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ContractStatus } from '@prisma/client';

/** Canonical commercial service type codes (design §7). */
export const CONTRACT_SERVICE_TYPES = [
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

export type ContractServiceType = (typeof CONTRACT_SERVICE_TYPES)[number];

/** Align with Customer paymentTerms + ON_INVOICE. */
export const CONTRACT_PAYMENT_TERMS = [
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'PREPAID',
  'ON_INVOICE',
] as const;

export const CONTRACT_CURRENCIES = ['TZS', 'USD', 'EUR', 'KES'] as const;

export const CONTRACT_KINDS = ['NEW', 'RENEWAL', 'AMENDMENT'] as const;

export const CONTRACT_INVOICE_FREQUENCIES = ['MONTHLY', 'WEEKLY'] as const;

export const CONTRACT_SLA_LEVELS = ['STANDARD', 'PREMIUM', 'CRITICAL'] as const;

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'CTR-2026-001' })
  @IsString()
  contractNumber!: string;

  @ApiProperty({ example: 'Manned Guarding — Warehouse A' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    type: [String],
    enum: CONTRACT_SERVICE_TYPES,
    example: ['SECURITY_GUARD', 'CCTV_MONITORING'],
    description:
      'Preferred. At least one required unless legacy serviceType is sent.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn([...CONTRACT_SERVICE_TYPES], { each: true })
  serviceTypes?: string[];

  /** @deprecated Prefer serviceTypes. Kept for backward compatibility. */
  @ApiPropertyOptional({
    example: 'SECURITY_GUARD',
    enum: CONTRACT_SERVICE_TYPES,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_SERVICE_TYPES])
  serviceType?: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2027-07-31' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 4500000 })
  @IsNumber()
  @Min(0)
  monthlyFee!: number;

  @ApiPropertyOptional({ example: 'TZS', enum: CONTRACT_CURRENCIES })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_CURRENCIES])
  currency?: string;

  @ApiPropertyOptional({
    example: 'NET_30',
    enum: CONTRACT_PAYMENT_TERMS,
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_PAYMENT_TERMS])
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  guardCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slaTerms?: string;

  @ApiPropertyOptional({ example: 'NEW', enum: CONTRACT_KINDS, default: 'NEW' })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_KINDS])
  contractKind?: string;

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  noticePeriodDays?: number;

  @ApiPropertyOptional({
    example: 'MONTHLY',
    enum: CONTRACT_INVOICE_FREQUENCIES,
    default: 'MONTHLY',
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_INVOICE_FREQUENCIES])
  invoiceFrequency?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  vatApplicable?: boolean;

  @ApiPropertyOptional({
    example: 'STANDARD',
    enum: CONTRACT_SLA_LEVELS,
    default: 'STANDARD',
  })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_SLA_LEVELS])
  slaLevel?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Optional enterprise site ids covered by this contract (must belong to customer + org). Empty array = no sites yet.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteIds?: string[];
}

export class ReplaceContractSitesDto {
  @ApiProperty({
    type: [String],
    description: 'Full replacement set of site ids (DRAFT contracts only)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  siteIds!: string[];
}

export class UpdateContractStatusDto {
  @ApiProperty({ enum: ContractStatus, example: ContractStatus.ACTIVE })
  @IsEnum(ContractStatus)
  status!: ContractStatus;
}

export class RejectContractDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ContractSiteSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class ContractResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() contractNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty({
    description: 'Primary / display service type (first of serviceTypes)',
  })
  serviceType!: string;
  @ApiProperty({ type: [String], enum: CONTRACT_SERVICE_TYPES })
  serviceTypes!: string[];
  @ApiProperty({ enum: ContractStatus }) status!: ContractStatus;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() monthlyFee!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional({ enum: CONTRACT_PAYMENT_TERMS })
  paymentTerms?: string | null;
  @ApiPropertyOptional() guardCount?: number | null;
  @ApiPropertyOptional() slaTerms?: string | null;
  @ApiProperty({ example: 'NEW', enum: CONTRACT_KINDS })
  contractKind!: string;
  @ApiPropertyOptional() renewalDate?: Date | null;
  @ApiProperty() noticePeriodDays!: number;
  @ApiPropertyOptional({
    enum: CONTRACT_INVOICE_FREQUENCIES,
  })
  invoiceFrequency?: string | null;
  @ApiProperty() vatApplicable!: boolean;
  @ApiPropertyOptional({ enum: CONTRACT_SLA_LEVELS })
  slaLevel?: string | null;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional({
    description: 'Approval instance status when approvalInstanceId is set',
  })
  approvalStatus?: string;
  @ApiPropertyOptional({
    description: 'Current step order on the approval instance',
  })
  approvalCurrentStepOrder?: number;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Name of the current pending approval step',
  })
  approvalCurrentStepName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Role required for the current pending approval step',
  })
  approvalRequiredRole?: string | null;
  @ApiProperty({ type: [String], description: 'Bound enterprise site ids' })
  siteIds!: string[];
  @ApiProperty({ type: [ContractSiteSummaryDto] })
  sites!: ContractSiteSummaryDto[];
  @ApiProperty() createdAt!: Date;
}
