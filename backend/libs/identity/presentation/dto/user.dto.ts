import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'hr.officer@highlink.co.tz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'HR Officer' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ type: [String], example: ['SUPER_ADMIN'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class SuspendUserDto {
  @ApiPropertyOptional({ example: 'Policy violation — pending investigation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetUserRolesDto {
  @ApiProperty({ type: [String], example: ['HR_OFFICER', 'PAYROLL_OFFICER'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;
}
