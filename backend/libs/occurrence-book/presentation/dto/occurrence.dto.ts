import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateOccurrenceDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'VISITOR_ISSUE' })
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty()
  @IsDateString()
  recordedAt!: string;
}

export class CorrectOccurrenceDto {
  @ApiProperty({ description: 'Why this correction is needed (required)' })
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  category?: string;
}

export class OccurrenceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiPropertyOptional() siteCode?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiProperty() category!: string;
  @ApiProperty() description!: string;
  @ApiProperty() version!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiPropertyOptional() correctionReason?: string | null;
  @ApiPropertyOptional() officerId?: string | null;
  @ApiPropertyOptional({
    description: 'Null until second-person approve',
    nullable: true,
  })
  approvedBy?: string | null;
  @ApiProperty() recordedAt!: Date;
  @ApiProperty() createdAt!: Date;
}

/** One version in an append-only occurrence lineage (history timeline). */
export class OccurrenceHistoryVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() version!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() category!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() correctionReason?: string | null;
  @ApiPropertyOptional() officerId?: string | null;
  @ApiProperty() recordedAt!: Date;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() parentEntryId?: string | null;
  @ApiPropertyOptional({
    description: 'Null until second-person approve',
    nullable: true,
  })
  approvedBy?: string | null;
}
