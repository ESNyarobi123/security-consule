import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'CONTROL_ROOM_OFFICER' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: 'Control Room Officer' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['incidents.read', 'cctv.read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['incidents.read', 'incidents.manage'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class PermissionResponseDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  module!: string;
}

export class PortalCatalogRoleLiveDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  present!: boolean;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  userCount!: number;

  @ApiProperty()
  canEnter!: boolean;
}

export class PortalCatalogPortalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  primaryUsers!: string;

  @ApiProperty()
  job!: string;

  @ApiProperty()
  entry!: string;

  @ApiProperty({ type: [String] })
  gatePermissions!: string[];

  @ApiProperty({ type: [String] })
  accountTypeCodes!: string[];

  @ApiProperty({ type: [String] })
  roleCodes!: string[];

  @ApiProperty()
  security!: string;

  @ApiProperty()
  publicAccess!: boolean;

  @ApiProperty({ type: [PortalCatalogRoleLiveDto] })
  roles!: PortalCatalogRoleLiveDto[];

  @ApiProperty()
  liveUserCount!: number;
}

export class PortalCatalogAccountDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [String] })
  roleCodes!: string[];

  @ApiProperty({ type: [String] })
  portalIds!: string[];

  @ApiProperty()
  liveUserCount!: number;

  @ApiProperty()
  publicOrUnbound!: boolean;
}

export class PortalCatalogResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ type: [PortalCatalogPortalDto] })
  portals!: PortalCatalogPortalDto[];

  @ApiProperty({ type: [PortalCatalogAccountDto] })
  accountTypes!: PortalCatalogAccountDto[];

  @ApiProperty({
    description: 'Seeded roles in this org that are not listed on a §36 account type',
    type: [String],
  })
  unmappedRoleCodes!: string[];
}
