import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ContractStatus } from '@prisma/client';

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'CTR-2026-001' })
  @IsString()
  contractNumber!: string;

  @ApiProperty({ example: 'Manned Guarding — Warehouse A' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'SECURITY_GUARD' })
  @IsString()
  serviceType!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2027-07-31' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 4500000 })
  @IsNumber()
  @Min(0)
  monthlyFee!: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  guardCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slaTerms?: string;
}

export class UpdateContractStatusDto {
  @ApiProperty({ enum: ContractStatus, example: ContractStatus.ACTIVE })
  @IsEnum(ContractStatus)
  status!: ContractStatus;
}

export class ContractResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() contractNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty() serviceType!: string;
  @ApiProperty({ enum: ContractStatus }) status!: ContractStatus;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() monthlyFee!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() guardCount?: number | null;
  @ApiProperty() createdAt!: Date;
}
