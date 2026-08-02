import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteCustomerPortalUserDto {
  @ApiProperty({ example: 'security.admin@demo-mfg.co.tz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Demo Manufacturing Portal Admin' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional({ example: '+255712000999' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class PortalUserResponseDto {
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

  @ApiPropertyOptional()
  customerId?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;
}

export class InviteCustomerPortalUserResponseDto extends PortalUserResponseDto {
  @ApiProperty({
    description: 'Plain temporary password — shown once; also emailed when outbox is up',
  })
  temporaryPassword!: string;

  @ApiProperty({
    description: 'True when CUSTOMER_PORTAL_INVITE was queued to the notification outbox',
  })
  notificationQueued!: boolean;
}
