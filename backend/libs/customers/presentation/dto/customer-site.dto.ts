import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/** Module 6-E — create site bound to :customerId (customerId forced server-side). */
export class CreateCustomerSiteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ example: 'SITE-CUST-WH-02' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Customer Warehouse B' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

/** Module 6-F — edit/deactivate; code & branch immutable here. */
export class UpdateCustomerSiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomerSiteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() branchId!: string;
  @ApiPropertyOptional() customerId?: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty() isActive!: boolean;
}
