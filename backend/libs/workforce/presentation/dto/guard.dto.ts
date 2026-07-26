import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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
}

export class UpdateGuardStatusDto {
  @ApiProperty({ enum: GuardStatus })
  @IsEnum(GuardStatus)
  status!: GuardStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deploymentEligible?: boolean;
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
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) photoUrl!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ type: GuardEmployeeSummaryDto, nullable: true })
  employee!: GuardEmployeeSummaryDto | null;
  @ApiPropertyOptional({ type: GuardActiveDeploymentDto, nullable: true })
  activeDeployment!: GuardActiveDeploymentDto | null;
}
