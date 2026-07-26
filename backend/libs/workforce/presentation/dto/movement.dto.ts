import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementStatus, MovementType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateEmployeeMovementDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  type!: MovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDepartment?: string;

  @ApiPropertyOptional({
    description: 'Required for TRANSFER — destination department',
  })
  @ValidateIf((o: CreateEmployeeMovementDto) => o.type === MovementType.TRANSFER)
  @IsString()
  @MinLength(1)
  toDepartment?: string;

  @ApiProperty()
  @IsDateString()
  effectiveDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class RejectEmployeeMovementDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class EmployeeMovementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty({ enum: MovementType }) type!: MovementType;
  @ApiPropertyOptional() fromDepartment?: string | null;
  @ApiPropertyOptional() toDepartment?: string | null;
  @ApiProperty() effectiveDate!: Date;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: MovementStatus }) status!: MovementStatus;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() rejectedReason?: string | null;
  @ApiProperty() createdAt!: Date;
}
