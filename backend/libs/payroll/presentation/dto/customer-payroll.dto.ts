import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCustomerSalaryAssignmentDto {
  @ApiProperty()
  @IsUUID()
  customerEmployeeId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basicSalary!: number;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Allowance map e.g. TRANSPORT, MEAL' })
  @IsOptional()
  @IsObject()
  allowances?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Fixed deductions map e.g. ADVANCE, UNION' })
  @IsOptional()
  @IsObject()
  deductions?: Record<string, number>;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;
}

export class UpdateCustomerSalaryAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hourlyRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  allowances?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  deductions?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomerSalaryAssignmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() customerEmployeeId!: string;
  @ApiPropertyOptional() employeeName?: string;
  @ApiPropertyOptional() employeeNumber?: string;
  @ApiProperty() basicSalary!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() hourlyRate?: number | null;
  @ApiPropertyOptional() allowances?: unknown;
  @ApiPropertyOptional() deductions?: unknown;
  @ApiProperty() effectiveFrom!: Date;
  @ApiPropertyOptional() effectiveUntil?: Date | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}
