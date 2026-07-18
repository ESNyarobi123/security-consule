import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from the authenticator app' })
  @IsString()
  @Length(6, 8)
  code!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'Base32 secret to enter manually in the authenticator app' })
  secret!: string;

  @ApiProperty({ description: 'otpauth:// URI to render as a QR code' })
  otpauthUri!: string;
}

export class MfaStatusDto {
  @ApiProperty()
  mfaEnabled!: boolean;
}
