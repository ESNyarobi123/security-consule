import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@prisma/client';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ default: 21 })
  @IsOptional()
  @IsInt()
  @Min(1)
  annualQuotaDays?: number;
}

export class LeaveTypeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() annualQuotaDays!: number;
  @ApiProperty() isActive!: boolean;
}

export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  days!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class LeaveRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() leaveTypeId!: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() days!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: LeaveRequestStatus }) status!: LeaveRequestStatus;
  @ApiPropertyOptional() approvalInstanceId?: string | null;
  @ApiPropertyOptional() approvedBy?: string | null;
  @ApiPropertyOptional() approvedAt?: Date | null;
  @ApiPropertyOptional() rejectedReason?: string | null;
  @ApiProperty() createdAt!: Date;
}
