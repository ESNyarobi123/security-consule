import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

/**
 * Portal 35.23 / Module 27-A — branch staff management.
 * Branch scoping is enforced server-side (JWT branch/site ACL); `branchId`
 * can only name a branch the caller already covers.
 */
export class CreateBranchStaffDto {
  @ApiProperty({ example: 'Neema Mushi' })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({
    description: 'Auto-generated EMP-#### when omitted',
    example: 'EMP-1001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: EmploymentType.OTHER })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({
    description:
      'Branch posting. Defaults to the only branch in scope when omitted.',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'ISO date; defaults to today' })
  @IsOptional()
  @IsString()
  hireDate?: string;
}

export class UpdateBranchStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @ApiPropertyOptional({ description: 'Branch transfer within caller scope' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    enum: EmployeeStatus,
    description:
      'ACTIVE | ON_LEAVE | SUSPENDED. TERMINATED/exit stays HR Movements.',
  })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}

export class BranchStaffRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() employeeNumber!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiProperty() employmentType!: EmploymentType;
  @ApiProperty() status!: EmployeeStatus;
  @ApiPropertyOptional() hireDate?: Date | null;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiPropertyOptional() branchCode?: string | null;
  @ApiPropertyOptional() branchName?: string | null;
  @ApiPropertyOptional() guardId?: string | null;
  @ApiPropertyOptional() guardStatus?: string | null;
  @ApiPropertyOptional() siteId?: string | null;
  @ApiPropertyOptional() siteCode?: string | null;
  @ApiPropertyOptional() siteName?: string | null;
  @ApiPropertyOptional() hasLogin?: boolean;
  @ApiProperty() canEdit!: boolean;
}

export class BranchStaffOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}
