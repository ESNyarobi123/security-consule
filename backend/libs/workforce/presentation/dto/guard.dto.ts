import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { GuardStatus } from '@prisma/client';

export class CreateGuardDto {
  @ApiProperty({ description: 'IAM user id to link as guard' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'GRD-0001' })
  @IsString()
  employeeNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Optional HR Employee to link (must be unlinked)',
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({
    description: 'Mark deployable at create (default false)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deploymentEligible?: boolean;
}

export class UpdateGuardStatusDto {
  @ApiProperty({ enum: GuardStatus })
  @IsEnum(GuardStatus)
  status!: GuardStatus;

  @ApiPropertyOptional({
    description:
      'G3: incomplete training/clearance does not hard-block deployable (UI may warn)',
  })
  @IsOptional()
  @IsBoolean()
  deploymentEligible?: boolean;

  /** Module 8-E — optional note when marking ABSENT (stored on closed punch remarks). */
  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

/** Thin G3 readiness checklist — does not gate deploymentEligible. */
export class UpdateGuardReadinessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trainingCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firearmAuthorized?: boolean;

  @ApiPropertyOptional({
    description: 'ISO date (YYYY-MM-DD); null clears expiry',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  firearmExpiry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clearanceVerified?: boolean;

  /** Module 8-B — medical fitness */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  medicalFitnessVerified?: boolean;

  @ApiPropertyOptional({
    description: 'ISO date (YYYY-MM-DD); null clears expiry',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  medicalFitnessExpiry?: string | null;

  /** Module 8-B — national / work ID reference (not full docs vault) */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  nationalIdRef?: string | null;

  /** Module 8-C — kit checklist (asset ledger remains libs/assets) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  uniformIssued?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  equipmentIssued?: boolean;
}

export class GuardEmployeeSummaryDto {
  @ApiProperty({ description: 'Employee record id' })
  employeeId!: string;

  @ApiProperty()
  fullName!: string;
}

export class GuardActiveDeploymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional({ nullable: true })
  siteCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  siteName!: string | null;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  status!: string;
}

export class GuardResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty({ enum: GuardStatus }) status!: GuardStatus;
  @ApiProperty() deploymentEligible!: boolean;
  /** Module 8-A — ACTIVE / AVAILABLE may toggle deployable. */
  @ApiProperty() canToggleDeployable!: boolean;
  /** Module 8-A — ops status transitions (TERMINATED → []). */
  @ApiProperty({ enum: GuardStatus, isArray: true })
  allowedNextStatuses!: GuardStatus[];
  @ApiProperty() trainingCompleted!: boolean;
  @ApiProperty() firearmAuthorized!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  firearmExpiry!: Date | null;
  @ApiProperty() clearanceVerified!: boolean;
  @ApiProperty() medicalFitnessVerified!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  medicalFitnessExpiry!: Date | null;
  @ApiPropertyOptional({ nullable: true }) nationalIdRef!: string | null;
  @ApiProperty() uniformIssued!: boolean;
  @ApiProperty() equipmentIssued!: boolean;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) photoUrl!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ type: GuardEmployeeSummaryDto, nullable: true })
  employee!: GuardEmployeeSummaryDto | null;
  @ApiPropertyOptional({ type: GuardActiveDeploymentDto, nullable: true })
  activeDeployment!: GuardActiveDeploymentDto | null;
  /** Module 8-E — open punches closed when status → ABSENT (response-only). */
  @ApiPropertyOptional({ type: [String] })
  closedAttendanceIds?: string[];
  /** Module 8-F — SCHEDULED alertness cancelled when status → ABSENT. */
  @ApiPropertyOptional({ type: [String] })
  cancelledAlertnessIds?: string[];
}

export class LinkableGuardUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() isActive!: boolean;
}
