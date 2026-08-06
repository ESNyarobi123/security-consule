import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerContactRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Module 6-M — create contact under :customerId. */
export class CreateCustomerContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional({ example: 'Security Manager' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({
    enum: CustomerContactRole,
    default: CustomerContactRole.GENERAL,
  })
  @IsOptional()
  @IsEnum(CustomerContactRole)
  role?: CustomerContactRole;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altPhone?: string;

  @ApiPropertyOptional({ description: 'At most one primary per customer' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Module 6-M — update / deactivate contact. */
export class UpdateCustomerContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  designation?: string | null;

  @ApiPropertyOptional({ enum: CustomerContactRole })
  @IsOptional()
  @IsEnum(CustomerContactRole)
  role?: CustomerContactRole;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '' && v !== undefined)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  altPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CustomerContactResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() designation?: string | null;
  @ApiProperty({ enum: CustomerContactRole }) role!: CustomerContactRole;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() altPhone?: string | null;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty() createdAt!: Date;
}
