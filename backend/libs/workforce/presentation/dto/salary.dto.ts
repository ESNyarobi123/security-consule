import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateSalaryAssignmentDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ example: 850000 })
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

  @ApiPropertyOptional()
  @IsOptional()
  allowances?: Record<string, number>;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;
}

export class SalaryAssignmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() basicSalary!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() hourlyRate?: number | null;
  @ApiPropertyOptional() allowances?: unknown;
  @ApiProperty() effectiveFrom!: Date;
  @ApiPropertyOptional() effectiveUntil?: Date | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}
