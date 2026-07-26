import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisciplineSeverity, DisciplineStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateDisciplineCaseDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  incidentDate!: string;

  @ApiProperty({ example: 'Attendance' })
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiPropertyOptional({ enum: DisciplineSeverity })
  @IsOptional()
  @IsEnum(DisciplineSeverity)
  severity?: DisciplineSeverity;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description!: string;
}

export class UpdateDisciplineCaseDto {
  @ApiPropertyOptional({ enum: DisciplineStatus })
  @IsOptional()
  @IsEnum(DisciplineStatus)
  status?: DisciplineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ enum: DisciplineSeverity })
  @IsOptional()
  @IsEnum(DisciplineSeverity)
  severity?: DisciplineSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class DisciplineCaseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() incidentDate!: Date;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: DisciplineSeverity }) severity!: DisciplineSeverity;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: DisciplineStatus }) status!: DisciplineStatus;
  @ApiPropertyOptional() outcome?: string | null;
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiProperty() createdAt!: Date;
}
