import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
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

export class ResetPasswordDto {
  @ApiProperty({
    example: 'TempPass1!',
    description: 'Temporary password — target must change on next login (M5-I)',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class SetUserRolesDto {
  @ApiProperty({ type: [String], example: ['HR_OFFICER', 'PAYROLL_OFFICER'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class RejectIamChangeDto {
  @ApiPropertyOptional({ example: 'Roles not justified for this post' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PasswordPolicyDto {
  @ApiProperty({ example: 10, minimum: 8, maximum: 128 })
  @IsInt()
  @Min(8)
  @Max(128)
  minLength!: number;

  @ApiProperty()
  @IsBoolean()
  requireUppercase!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireLowercase!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireDigit!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireSymbol!: boolean;

  @ApiPropertyOptional({
    description: 'Human-readable summary of the resolved policy',
  })
  summary?: string;
}

export class IamChangeRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  targetUserId!: string;

  @ApiPropertyOptional()
  targetEmail?: string;

  @ApiPropertyOptional()
  targetFullName?: string;

  @ApiProperty()
  changeType!: string;

  @ApiProperty({ type: [String] })
  proposedRoleCodes!: string[];

  @ApiProperty({ type: [String] })
  previousRoleCodes!: string[];

  @ApiPropertyOptional({
    description: 'Justification when changeType=SUSPEND or REACTIVATE',
  })
  reason?: string | null;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  approvalInstanceId?: string | null;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional()
  decidedBy?: string | null;

  @ApiPropertyOptional()
  decidedAt?: Date | null;

  @ApiPropertyOptional()
  rejectReason?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class SetUserAccessDto {
  @ApiProperty({
    type: [String],
    description: 'Branch IDs to grant (replaces all). Empty = no branch ACL.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds!: string[];

  @ApiProperty({
    type: [String],
    description: 'Site IDs to grant (replaces all). Empty = no direct site ACL.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  siteIds!: string[];
}

export class AccessBranchDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class AccessSiteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  branchId!: string;
}

export class UserAccessResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [String] })
  branchIds!: string[];

  @ApiProperty({ type: [String] })
  siteIds!: string[];

  @ApiProperty({ type: [AccessBranchDto] })
  branches!: AccessBranchDto[];

  @ApiProperty({ type: [AccessSiteDto] })
  sites!: AccessSiteDto[];

  @ApiProperty({
    description: 'Org catalog for the ACL picker (users.manage; no ops perm needed)',
  })
  catalog!: {
    branches: AccessBranchDto[];
    sites: AccessSiteDto[];
  };
}

export class LoginHistoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  ipAddress?: string | null;

  @ApiPropertyOptional()
  userAgent?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({
    description: 'True when account must replace temporary password (M5-H)',
  })
  mustChangePassword!: boolean;

  @ApiProperty({ description: 'Whether TOTP MFA is enabled (M5-C/J)' })
  mfaEnabled!: boolean;

  @ApiPropertyOptional()
  lastLoginAt?: Date | null;

  @ApiPropertyOptional()
  suspendedAt?: Date | null;

  @ApiPropertyOptional()
  suspendedReason?: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;
}
