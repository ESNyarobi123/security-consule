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
