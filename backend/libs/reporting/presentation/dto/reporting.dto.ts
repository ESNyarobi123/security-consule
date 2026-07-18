import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KpiPeriodGranularity } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ExecutiveDashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-14' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: KpiPeriodGranularity })
  @IsOptional()
  @IsEnum(KpiPeriodGranularity)
  granularity?: KpiPeriodGranularity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class KpiItemDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() value!: number;
  @ApiPropertyOptional() priorValue?: number | null;
  @ApiPropertyOptional() deltaPct?: number | null;
  @ApiProperty() asOf!: Date;
  @ApiProperty({ enum: ['live', 'snapshot'] }) source!: 'live' | 'snapshot';
  @ApiPropertyOptional() breakdown?: Record<string, unknown>;
}

export class ExecutiveDashboardResponseDto {
  @ApiProperty() organizationId!: string;
  @ApiProperty() generatedAt!: Date;
  @ApiProperty() period!: {
    from: string;
    to: string;
    granularity: KpiPeriodGranularity;
  };
  @ApiProperty({ type: [KpiItemDto] }) kpis!: KpiItemDto[];
  @ApiProperty({ type: [Object] }) insights!: Record<string, unknown>[];
  @ApiProperty() cache!: { hit: boolean; expiresAt: Date | null };
}

export class RefreshKpisDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-14' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codes?: string[];

  @ApiPropertyOptional({ enum: KpiPeriodGranularity })
  @IsOptional()
  @IsEnum(KpiPeriodGranularity)
  granularity?: KpiPeriodGranularity;
}

export class ForecastInsightDto {
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  horizonMonths?: number;
}

export class AnomalyInsightDto {
  @ApiPropertyOptional({ default: 'ATTENDANCE' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsNumber()
  threshold?: number;
}

export class AnalyticsInsightResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() insightType!: string;
  @ApiProperty() domain!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiPropertyOptional() score?: number | null;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;
}

export class ReportingHealthDto {
  @ApiProperty() status!: string;
  @ApiProperty() service!: string;
  @ApiProperty() analyticsAi!: { status: string; url: string };
}
