import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@highlink.co.tz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'TOTP code — required only when the account has MFA enabled',
  })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class AuthUserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty({ type: [String] })
  allowedBranchIds!: string[];

  @ApiProperty({ type: [String] })
  allowedSiteIds!: string[];

  @ApiPropertyOptional({ description: 'Bound customer for CUSTOMER_PORTAL users' })
  customerId?: string | null;

  @ApiPropertyOptional({ description: 'Bound supplier for SUPPLIER_PORTAL users' })
  supplierId?: string | null;

  @ApiPropertyOptional({
    description: 'Bound B2B partner for OTHER_SECURITY_COMPANY users',
  })
  b2bPartnerId?: string | null;

  @ApiPropertyOptional({
    description: 'True when a temporary password must be replaced before normal use',
  })
  mustChangePassword?: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;

  @ApiProperty({ type: AuthUserProfileDto })
  user!: AuthUserProfileDto;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Hl-tempPass!9A' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
