import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
  deploymentEligible?: boolean;
}

export class GuardResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty({ enum: GuardStatus }) status!: GuardStatus;
  @ApiProperty() deploymentEligible!: boolean;
  @ApiProperty() createdAt!: Date;
}
