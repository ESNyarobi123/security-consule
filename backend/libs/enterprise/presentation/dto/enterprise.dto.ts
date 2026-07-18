import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'DSM-HQ' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Dar es Salaam HQ' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Dar es Salaam' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class BranchResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() region?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'OPS' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Operations' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class DepartmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}

export class CreateSiteDto {
  @ApiProperty()
  @IsString()
  branchId!: string;

  @ApiProperty({ example: 'SITE-001' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Customer Warehouse A' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class SiteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() branchId!: string;
  @ApiPropertyOptional() customerId?: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}

export class OrganizationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiPropertyOptional() tin?: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CreateGateDto {
  @ApiProperty()
  @IsString()
  siteId!: string;

  @ApiProperty({ example: 'GATE-MAIN' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Main Vehicle Gate' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['PEDESTRIAN', 'VEHICLE', 'MIXED'] })
  @IsOptional()
  @IsString()
  gateType?: 'PEDESTRIAN' | 'VEHICLE' | 'MIXED';
}

export class GateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() gateType!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}
