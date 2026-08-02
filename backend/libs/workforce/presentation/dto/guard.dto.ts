import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
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
  @ApiProperty() trainingCompleted!: boolean;
  @ApiProperty() firearmAuthorized!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  firearmExpiry!: Date | null;
  @ApiProperty() clearanceVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) photoUrl!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ type: GuardEmployeeSummaryDto, nullable: true })
  employee!: GuardEmployeeSummaryDto | null;
  @ApiPropertyOptional({ type: GuardActiveDeploymentDto, nullable: true })
  activeDeployment!: GuardActiveDeploymentDto | null;
}

export class LinkableGuardUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() isActive!: boolean;
}
